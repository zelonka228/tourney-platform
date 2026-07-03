const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, VerticalMergeType, PageNumber, Footer
} = require("docx");

const FONT = "Times New Roman";
const b = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: b, bottom: b, left: b, right: b };
const m = { top: 40, bottom: 40, left: 70, right: 70 };

function tc(text, { w, span, vmerge, head=false, center=false, bold=false } = {}) {
  const opts = { borders, margins: m, verticalAlign: VerticalAlign.CENTER };
  if (w) opts.width = { size: w, type: WidthType.DXA };
  if (span) opts.columnSpan = span;
  if (vmerge) opts.verticalMerge = vmerge;
  if (head) opts.shading = { fill: "D9D9D9", type: ShadingType.CLEAR };
  opts.children = [ new Paragraph({
    alignment: (center||head) ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 0, line: 252 },
    children: [ new TextRun({ text: text ?? "", bold: head||bold, size: 22 }) ],
  }) ];
  return new TableCell(opts);
}

const COLS = [620, 5060, 480, 480, 480, 480, 1760]; // = 9360

// Задачі: [номер, назва, [активні тижні]]
const TASKS = [
  ["1","Аналіз ринку та конкурентів (Challonge, Toornament, Battlefy), виявлення недоліків",[1]],
  ["2","Формування концепції продукту та ключових переваг над аналогами",[1]],
  ["3","Аналіз архітектури аналогів та вибір технологічного стеку",[1,2]],
  ["4","Аналіз UX аналогів і проєктування структури сторінок застосунку",[1,2]],
  ["5","Проєктування схеми бази даних (Team, Player, Tournament, Match, Rating)",[2]],
  ["6","Розробка прототипу інтерфейсу (React): навігація та основні сторінки",[2,3]],
  ["7","Реалізація алгоритму генерації турнірної сітки (посів, «баї», single/double elimination)",[3]],
  ["8","Реалізація форматів матчів (BO1/BO3/BO5) та логіки визначення переможця",[3]],
  ["9","Реалізація поігрової рейтингової системи команд (FACEIT ELO / MMR / звання)",[3]],
  ["10","Розробка backend API (Node.js/Express): турніри, команди, учасники",[2,3]],
  ["11","Реалізація live-оновлення результатів матчів (WebSocket)",[3,4]],
  ["12","Розробка генератора RPG-карток команд (статистика, ранги, експорт у PNG)",[4]],
  ["13","Тестування основного функціоналу та виправлення помилок",[4]],
  ["14","Підготовка документації та підсумкового звіту з практики",[4]],
];

const VM = VerticalMergeType;
const headerRow1 = new TableRow({ tableHeader:true, children:[
  tc("№ з/п", { w:COLS[0], vmerge:VM.RESTART, head:true }),
  tc("Назви робіт", { w:COLS[1], vmerge:VM.RESTART, head:true }),
  tc("Тижні проходження практики", { span:4, head:true }),
  tc("Відмітки про виконання", { w:COLS[6], vmerge:VM.RESTART, head:true }),
]});
const headerRow2 = new TableRow({ tableHeader:true, children:[
  tc("", { vmerge:VM.CONTINUE }),
  tc("", { vmerge:VM.CONTINUE }),
  tc("1",{w:COLS[2],head:true}), tc("2",{w:COLS[3],head:true}),
  tc("3",{w:COLS[4],head:true}), tc("4",{w:COLS[5],head:true}),
  tc("", { vmerge:VM.CONTINUE }),
]});
const dataRows = TASKS.map(([n,name,weeks]) => new TableRow({ children:[
  tc(n, { w:COLS[0], center:true }),
  tc(name, { w:COLS[1] }),
  ...[1,2,3,4].map((wk,i)=> tc(weeks.includes(wk) ? "+" : "", { w:COLS[2+i], center:true })),
  tc("", { w:COLS[6] }),
]}));

const calTable = new Table({
  width:{ size:9360, type:WidthType.DXA }, columnWidths:COLS,
  rows:[ headerRow1, headerRow2, ...dataRows ],
});

// ---- Робочі записи ----
const WEEKS = [
  ["Тиждень 1", [
    ["Аналіз ринку та конкурентів", "Проведено дослідження трьох провідних платформ — Challonge, Toornament і Battlefy. Для кожної визначено цільову аудиторію, ключові можливості та недоліки (застарілий інтерфейс, складний онбординг, відсутність персистентного профілю команди й ігрових елементів). Результати зведено в порівняльну таблицю."],
    ["Формування концепції продукту", "Сформовано концепцію веб-платформи для організації турнірів та LAN-вечірок з автоматичною генерацією сітки та RPG-картками команд. Визначено три ключові переваги над аналогами: простий онбординг, наскрізний профіль команди та шерабельна колекційна картка."],
    ["Аналіз архітектури аналогів і вибір стеку", "Проаналізовано типову клієнт-серверну архітектуру сервісів цього класу. Обрано та обґрунтовано технологічний стек: React (frontend), Node.js + Express (backend), PostgreSQL (база даних) і WebSocket для оновлень у реальному часі. Розглянуто й відхилено альтернативи (Python/FastAPI, Rust)."],
    ["Проєктування структури сторінок", "На основі UX-аналізу аналогів спроєктовано структуру з шести ключових сторінок (головна, створення турніру, сторінка турніру, команда, профіль, загальний рейтинг) та створено робочий прототип інтерфейсу для перевірки навігації."],
  ]],
  ["Тиждень 2", [
    ["Проєктування схеми бази даних", "Розроблено схему основних сутностей — Team, Player, Tournament, Match та історія рейтингу — з визначенням полів і зв'язків між ними."],
    ["Уточнення моделі рейтингу", "Уточнено модель рейтингу команди: замість єдиної умовної шкали обрано поігровий підхід — середнє рейтингів гравців у рідній одиниці дисципліни (FACEIT ELO для CS2, MMR для Dota 2, звання для Valorant)."],
    ["Розробка прототипу інтерфейсу", "Реалізовано базову структуру React-застосунку з маршрутизацією та основними сторінками; дані винесено в окремий модуль для подальшої заміни на запити до API."],
    ["Початок розробки backend API", "Створено каркас серверної частини (Express + Socket.io) з базовими маршрутами для турнірів і команд та допоміжними алгоритмами."],
  ]],
  ["Тиждень 3", [
    ["Алгоритм генерації турнірної сітки", "Реалізовано автоматичну побудову сітки single/double elimination зі стандартним посівом учасників та коректним розподілом «баїв» для непарної кількості команд; переможці автоматично просуваються до наступного раунду аж до фіналу."],
    ["Формати матчів BO1/BO3/BO5", "Додано вибір формату матчу; введення рахунку обмежено валідними результатами обраного формату (наприклад, 2:0 чи 2:1 для BO3), що виключає некоректні дані та автоматично визначає переможця."],
    ["Поігрова рейтингова система", "Реалізовано обчислення рейтингу команди як середнього рейтингів гравців у одиниці дисципліни, а також загальний рейтинг команд із фільтром за грою."],
    ["Backend API та початок WebSocket", "Реалізовано серверні маршрути для створення турнірів і реєстрації команд; розпочато інтеграцію live-оновлення результатів матчів через WebSocket."],
  ]],
  ["Тиждень 4", [
    ["Live-оновлення результатів", "Завершено реалізацію оновлення результатів матчів у реальному часі через WebSocket із синхронізацією стану сітки між клієнтами."],
    ["Генератор RPG-карток команд", "Розроблено генерацію картки команди зі статистикою, складом і рангом та її експорт у зображення (PNG) для поширення в соцмережах."],
    ["Тестування та виправлення помилок", "Проведено тестування основного функціоналу на різних сценаріях; виявлено й усунено помилки (зокрема в логіці просування переможців і розподілі «баїв»)."],
    ["Документація та підсумковий звіт", "Підготовлено документацію проєкту (архітектура, використані технології, опис функціоналу) та написано підсумковий звіт з практики."],
  ]],
];

const children = [
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:60},
    children:[ new TextRun({ text:"ПРОЕКТНО-ТЕХНОЛОГІЧНА ПРАКТИКА", bold:true, size:28 }) ] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:40},
    children:[ new TextRun({ text:"Тема: Веб-платформа для організації турнірів та LAN-вечірок з RPG-картками команд", italics:true, size:24 }) ] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:160},
    children:[ new TextRun({ text:"Виконавці: Верещагін Сергій (backend/алгоритми), Герасимов Володимир (frontend/UX)", size:22 }) ] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:140},
    children:[ new TextRun({ text:"Календарний графік проходження практики", bold:true, size:26 }) ] }),
  calTable,
  new Paragraph({ spacing:{before:300, after:120},
    children:[ new TextRun({ text:"Робочі записи під час практики", bold:true, size:26 }) ] }),
];

for (const [week, items] of WEEKS) {
  children.push(new Paragraph({ spacing:{before:160, after:80},
    children:[ new TextRun({ text:week, bold:true, size:24 }) ] }));
  for (const [title, desc] of items) {
    children.push(new Paragraph({ spacing:{after:100, line:276}, alignment:AlignmentType.JUSTIFIED,
      children:[ new TextRun({ text:title + ": ", bold:true }), new TextRun({ text:desc }) ] }));
  }
}

const doc = new Document({
  styles:{ default:{ document:{ run:{ font:FONT, size:24, language:{ value:"uk-UA" } } } } },
  sections:[{
    properties:{ page:{ size:{width:11906,height:16838}, margin:{top:1134,right:1134,bottom:1134,left:1701} } },
    footers:{ default:new Footer({ children:[ new Paragraph({ alignment:AlignmentType.CENTER,
      children:[ new TextRun({ children:[PageNumber.CURRENT], size:20 }) ] }) ] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf=>{ fs.writeFileSync("Календарний_графік_v2.docx", buf); console.log("WROTE Календарний_графік_v2.docx", buf.length, "bytes"); });
