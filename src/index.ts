const HELP = `群内安价收集(ak是アンカー罗马字缩写)
注意ak后面有空格，“.ak”也可以换成“.安价”

.ak help //查看帮助
.ak # 标题 //新建一轮分歧并设标题
.ak + 选项 //需要添加的选项的内容
.ak + 选项1|选项2|选项3 //多个选项用|分隔
.ak - 序号 //需要移除的选项的序号
.ak ? //列出目前所有选项
.ak = //随机抽取1个选项并继续
.ak = n //随机抽取n个选项并继续
`;

const STORAGE_KEY = 'anchor';
const OPTION_NUM_PER_PAGE = 15;//列出所有选项时，每页放多少个选项

//新建分歧
function akNew(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, title: string) {
  const data = {
    "title": title,
    "options":[]
  }
  ext.storageSet(STORAGE_KEY, JSON.stringify(data));
  seal.replyToSender(ctx, msg, `已新建分歧:${title}`);
}

//添加选项
function akAdd(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, option: string) {
  const data: {
    title: string;
    options: string[];
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || '{"title":"","options":[]}');

  data.options = data.options.concat(option.split("|"));
  seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n已添加第${data.options.length}个选项:${option}`);

  ext.storageSet(STORAGE_KEY, JSON.stringify(data));
}

//移除选项
function akDel(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo, index: number) {
  const data: {
    title: string;
    options: string[];
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || '{"title":"","options":[]}');

  const removed = data.options.splice(index-1, 1)[0];
  seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n已移除第${index}个选项:${removed}`);

  ext.storageSet(STORAGE_KEY, JSON.stringify(data));
}

//列表
function akList(ctx: seal.MsgContext, msg: seal.Message, ext: seal.ExtInfo) {
  const data: {
    title: string;
    options: string[];
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || '{"title":"","options":[]}');

  if (data.options.length === 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n还没有任何选项呢`);
    return;
  }

  let optStr = '';
  let curPageRows = 0;//当前页已经添加的选项数
  data.options.forEach((value, index) => {
    optStr += `${index + 1}.${value}\n`;
    ++curPageRows;
    //达到一页选项的上限就输出一次
    if (curPageRows >= OPTION_NUM_PER_PAGE) {
      seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n${optStr}`);
      optStr = '';
      curPageRows = 0;
    }
  });

  if (curPageRows > 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n${optStr}`);
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
  const data: {
    title: string;
    options: string[];
  } = JSON.parse(ext.storageGet(STORAGE_KEY) || '{"title":"","options":[]}');

  if (data.options.length === 0) {
    seal.replyToSender(ctx, msg, `当前分歧:${data.title}\n还没有任何选项呢`);
    return;
  }

  akList(ctx, msg, ext);//先列出所有选项

  let optStr = '';
  for (let i = 0; i < num; ++i){
    const r = randomInt(1, data.options.length);
    const result = data.options.splice(r - 1, 1);
    optStr += `${i + 1}.${result}\n`;
  }
  seal.replyToSender(ctx, msg, `结果是:\n${optStr}`);
  ext.storageSet(STORAGE_KEY, JSON.stringify(data));
}

function main() {
  // 注册扩展
  let ext = seal.ext.find('anchor');
  if (!ext) {
    ext = seal.ext.new('anchor', '憧憬少', '1.1.0');
    seal.ext.register(ext);
  }

  // 编写指令
  const cmdSeal = seal.ext.newCmdItemInfo();
  cmdSeal.name = '安价';
  cmdSeal.help = HELP;

  cmdSeal.solve = (ctx, msg, cmdArgs) => {
    try {
      let val = cmdArgs.getArgN(1);
      switch (val) {
        case '#': {
          const title = cmdArgs.getArgN(2);
          akNew(ctx, msg, ext, title);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '+': {
          const option = cmdArgs.getArgN(2);
          akAdd(ctx, msg, ext, option);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '-': {
          const index = Number(cmdArgs.getArgN(2));
          akDel(ctx, msg, ext, index);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '?':case '？': {
          akList(ctx, msg, ext);
          return seal.ext.newCmdExecuteResult(true);
        }
        case '=': {
          let num = 1;
          if (cmdArgs.args.length >= 2) {
            num = Number(cmdArgs.getArgN(2));
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
