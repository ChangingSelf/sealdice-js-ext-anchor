const HELP = `群内安价收集(ak是アンカー罗马字缩写)
“.ak”也可以换成“.安价”，//后面是注释，不用写

.ak help //查看帮助
.ak#标题 //新建一轮分歧并设标题
.ak+选项 //需要添加的选项的内容
.ak+选项1|选项2|选项3 //多个选项用|分隔
.ak-序号 //需要移除的选项的序号
.ak? //列出目前所有选项
.ak= //随机抽取1个选项并继续
.ak=n //随机抽取n个选项并继续
`;

const STORAGE_KEY = 'anchorPools';
const OPTION_NUM_PER_PAGE = 15;//列出所有选项时，每页放多少个选项

/**
 * 读取指定群聊的安价池
 * @param groupId 群号
 * @param ext 扩展信息对象
 * @returns 
 */
function loadPool(groupId:string,ext: seal.ExtInfo) {
  const emptyData = {
    [groupId]:{
      title: "",
      options:[]
    }
  }
  const data: {
    [groupId: string]: {
        title: string;
        options: string[];
    };
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || JSON.stringify(emptyData));
  return data[groupId] ?? emptyData[groupId];//如果没有，那么就新建一个安价池
}

//写入指定群聊的安价池
function dumpPool(groupId: string, ext: seal.ExtInfo,pool:{title: string;options: string[];}) {
  const emptyData = {
    [groupId]:{
      title: "",
      options:[]
    }
  }
  const data: {
    [groupId: string]: {
        title: string;
        options: string[];
    };
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || JSON.stringify(emptyData));

  data[groupId] = pool;
  ext.storageSet(STORAGE_KEY, JSON.stringify(data));
}



//新建分歧
function akNew(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, title: string) {
  const pool = loadPool(ctx.group.groupId, ext);
  if (pool.options.length > 0 || pool.title !== '') {
    //如果之前还有安价未结算，则先询问
    seal.replyToSender(ctx, msg, `当前分歧：${pool.title}\n请等本次安价结算之后再开新安价`);
    return;
  }
  pool.title = title;
  dumpPool(ctx.group.groupId, ext, pool);
  seal.replyToSender(ctx, msg, `已新建分歧:${title}`);
}

//添加选项
function akAdd(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, option: string) {
  const pool = loadPool(ctx.group.groupId, ext);
  const options = option.split("|");
  pool.options = pool.options.concat(options);
  if (options.length === 1) {
    seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n已添加第${pool.options.length}个选项:${option}`);
  } else {
    let i = pool.options.length - options.length + 1;
    let output = "";
    options.forEach(value => {
      output += `${i++}.${value}\n`;
    });
    seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n新添加${options.length}个选项:\n${output}`);
  }

  dumpPool(ctx.group.groupId, ext, pool);
}

//移除选项
function akDel(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, index: number) {
  const pool = loadPool(ctx.group.groupId, ext);

  const removed = pool.options.splice(index-1, 1)[0];
  seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n已移除第${index}个选项:${removed}`);

  dumpPool(ctx.group.groupId, ext, pool);
}

//列表
function akList(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo) {
  const pool = loadPool(ctx.group.groupId, ext);

  if (pool.options.length === 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n还没有任何选项呢`);
    return;
  }

  let optStr = '';
  let curPageRows = 0;//当前页已经添加的选项数
  pool.options.forEach((value, index) => {
    optStr += `${index + 1}.${value}\n`;
    ++curPageRows;
    //达到一页选项的上限就输出一次
    if (curPageRows >= OPTION_NUM_PER_PAGE) {
      seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n${optStr}`);
      optStr = '';
      curPageRows = 0;
    }
  });

  if (curPageRows > 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n${optStr}`);
  }
}

/**
 * 生成随机整数
 * @param min 最小值
 * @param max 最大值
 * @returns 位于[min,max]区间的随机整数
 */
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

//得出结果
function akGet(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, num:number = 1) {
  const pool = loadPool(ctx.group.groupId, ext);

  if (pool.options.length === 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${pool.title}\n还没有任何选项呢`);
    return;
  }

  akList(ctx, msg, ext);//先列出所有选项

  let optStr = '';
  const resultIndexes: number[] = [];//抽中的选项们的下标
  
  if (num > pool.options.length) {
    //如果需要抽的比选项数本身多，就全抽
    num = pool.options.length;
  }

  //先抽出全部序号
  for (let i = 0; i < num; ++i){
    let r = randomInt(1, pool.options.length);//结果的选项序号，(r - 1)才是数组下标
    while(resultIndexes.includes(r-1)) {
      r = randomInt(1, pool.options.length);//如果重复就重抽
    }
    resultIndexes.push(r-1);
  }
  //接着将没被抽出来的选项存到另一个数组，避免删除时选项位置变化造成无法定位。

  const tempList: string[] = [];
  pool.options.forEach((x, i) => {
    if (resultIndexes.includes(i)) {
      //如果是需要被删除的，那么就输出
      optStr += `${i + 1}.${x}\n`;
    } else {
      //否则保存到临时数组中
      tempList.push(x);
    }
  });
  pool.options = tempList;
  
  seal.replyToSender(ctx, msg, `结果是:\n${optStr}`);
  dumpPool(ctx.group.groupId, ext, pool);
}


//获取文本参数
function getTextArg(cmdArgs:seal.CmdArgs):string {
  return cmdArgs.rawArgs.replace(/[#\-+=?？ ]/, "");
}

//获取操作参数
function getOpArg(cmdArgs: seal.CmdArgs): string { 
  let op = cmdArgs.rawArgs.match(/[#\-+=?？ ]/);
  if (op) {
    return op[0];
  } else {
    return "";
  }
}

function main() {
  // 注册扩展
  let ext = seal.ext.find('anchor');
  if (!ext) {
    ext = seal.ext.new('anchor', '憧憬少', '1.2.0');
    seal.ext.register(ext);
  }

  // 编写指令
  const cmdSeal = seal.ext.newCmdItemInfo();
  cmdSeal.name = '安价';
  cmdSeal.help = HELP;

  cmdSeal.solve = (ctx, msg, cmdArgs) => {
    try {
      let val = getOpArg(cmdArgs);
      switch (val) {
        case '#': {
          const title = getTextArg(cmdArgs);
          akNew(ctx, msg, ext, title);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '+': {
          const option = getTextArg(cmdArgs).trim();
          akAdd(ctx, msg, ext, option);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '-': {
          const index = Number(getTextArg(cmdArgs));
          akDel(ctx, msg, ext, index);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '?':case '？': {
          akList(ctx, msg, ext);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '=': {
          let num = 1;
          let numN = Number(getTextArg(cmdArgs));
          if (numN > 1) {
            num = numN;
          }
          akGet(ctx, msg, ext, num);
          return seal.ext.newCmdExecuteResult(true);
        }
        case 'help': default:{
          const ret = seal.ext.newCmdExecuteResult(true);
          ret.showHelp = true;
          return ret;
        }
      }
    } catch (error) {
      seal.replyToSender(ctx, msg, error.Message);
      return seal.ext.newCmdExecuteResult(true);
    }
  }

  // 注册命令
  ext.cmdMap['安价'] = cmdSeal;
  ext.cmdMap['ak'] = cmdSeal;
}

main();
