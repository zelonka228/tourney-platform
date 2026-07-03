const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, Footer, TableOfContents, PageBreak, VerticalAlign
} = require("docx");

const FONT = "Times New Roman";
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 110, right: 110 };
const CONTENT_W = 9360;

function h1(t){ return new Paragraph({ heading: HeadingLevel.HEADING_1, children:[new TextRun(t)] }); }
function h2(t){ return new Paragraph({ heading: HeadingLevel.HEADING_2, children:[new TextRun(t)] }); }
function p(text, opts={}){ return new Paragraph({ spacing:{after:120,line:276}, alignment:AlignmentType.JUSTIFIED, indent:{firstLine:567}, children:[new TextRun({text,...opts})] }); }
function plain(text, opts={}){ return new Paragraph({ spacing:{after:120,line:276}, alignment:AlignmentType.JUSTIFIED, children:[new TextRun({text,...opts})] }); }
function bullet(t){ return new Paragraph({ numbering:{reference:"bullets",level:0}, spacing:{after:60,line:276}, alignment:AlignmentType.JUSTIFIED, children:[new TextRun(t)] }); }
function num(t){ return new Paragraph({ numbering:{reference:"nums",level:0}, spacing:{after:60,line:276}, alignment:AlignmentType.JUSTIFIED, children:[new TextRun(t)] }); }
function cell(text, { w, head=false, bold=false }={}){
  return new TableCell({
    borders, width:{size:w,type:WidthType.DXA}, margins:cellMargins, verticalAlign:VerticalAlign.CENTER,
    shading: head ? {fill:"D9E2F3",type:ShadingType.CLEAR} : undefined,
    children:(Array.isArray(text)?text:[text]).map(t=>new Paragraph({
      alignment: head?AlignmentType.CENTER:AlignmentType.LEFT, spacing:{after:0,line:264},
      children:[new TextRun({text:t,bold:head||bold})] })),
  });
}
function table(widths, rows){
  return new Table({ width:{size:CONTENT_W,type:WidthType.DXA}, columnWidths:widths,
    rows: rows.map((r,ri)=> new TableRow({
      tableHeader: ri===0,        // повторювати шапку при перенесенні таблиці
      cantSplit: true,            // не розривати рядок між сторінками
      children: r.map((c,ci)=> cell(c,{w:widths[ci],head:ri===0}) ) })) });
}
function gap(){ return new Paragraph({ spacing:{before:120}, children:[] }); }

const children = [];

// ---- Титул ----
children.push(
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:40}, children:[new TextRun({text:"ЗВЕДЕНА АНАЛІТИЧНА ЗАПИСКА",bold:true,size:30})] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:240}, children:[new TextRun({text:"Тиждень 1 — аналітично-дослідницький етап практики",size:26})] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:60}, children:[new TextRun({text:"Тема проєкту:",bold:true})] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:240}, children:[new TextRun({text:"Веб-платформа для організації турнірів та LAN-вечірок з RPG-картками команд",italics:true})] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:40}, children:[new TextRun({text:"Виконавці:",bold:true})] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:20}, children:[new TextRun("Верещагін Сергій — backend / алгоритми")] }),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:240}, children:[new TextRun("Герасимов Володимир — frontend / UX")] }),
  new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({text:"2026 рік",italics:true})] }),
  new Paragraph({ children:[new PageBreak()] }),
);

// ---- Зміст (авто; Word оновлює поля при відкритті завдяки updateFields) ----
children.push(
  new Paragraph({ spacing:{after:160}, children:[new TextRun({text:"ЗМІСТ",bold:true,size:26})] }),
  new TableOfContents("Зміст", { hyperlink:true, headingStyleRange:"1-2" }),
  new Paragraph({ children:[new PageBreak()] }),
);

// ---- Вступ ----
children.push(h1("Вступ"));
children.push(p("Перший тиждень практики присвячено аналітично-дослідницькому етапу. Його мета — дослідити ринок існуючих рішень, сформувати концепцію власного продукту з обґрунтованими перевагами, проаналізувати архітектуру та UX аналогів і спроєктувати структуру майбутнього застосунку. Ця записка зводить результати тижня та фіксує стан робочого прототипу, створеного для перевірки структури сторінок."));
children.push(plain("Завдання Тижня 1 за календарним графіком:", {bold:true}));
children.push(num("Аналіз ринку: дослідження аналогів (Challonge, Toornament, Battlefy), виявлення недоліків."));
children.push(num("Формування концепції проєкту та переваг над аналогами."));
children.push(num("Аналіз архітектури аналогічних застосунків (frontend/backend, БД, технології)."));
children.push(num("Аналіз UX аналогів та проєктування структури сторінок власного застосунку."));

// ===== 1. Конкуренти =====
children.push(h1("1. Зведення дослідження конкурентів"));
children.push(p("Для аналізу обрано три найпопулярніші платформи, що покривають різні сегменти аудиторії: Challonge (масовий аматорський сегмент), Toornament (професійні організатори ліг) і Battlefy (кіберспортивні майданчики). Для кожної визначено аудиторію, ключові можливості та недоліки."));

children.push(h2("1.1. Challonge"));
children.push(p("Один із найстаріших безкоштовних генераторів турнірних сіток (існує близько 15 років). Підтримує single/double elimination, round-robin та швейцарську систему, має API."));
children.push(plain("Недоліки:", {bold:true}));
children.push(bullet("Застарілий інтерфейс, незручний на мобільних пристроях."));
children.push(bullet("Рекламні банери у безкоштовній версії (прибираються лише на платному тарифі)."));
children.push(bullet("Статистика обмежена окремим турніром — немає персистентного профілю команди між подіями."));

children.push(h2("1.2. Toornament"));
children.push(p("Потужна платформа для професійних організаторів; нею користуються великі видавці (Riot, Ubisoft, Bethesda). Має широку кастомізацію та публічний API."));
children.push(plain("Недоліки:", {bold:true}));
children.push(bullet("Складний онбординг: налаштування навіть простого турніру вимагає багатьох кроків."));
children.push(bullet("Надмірний функціонал для невеликої компанії друзів чи районної LAN-party."));
children.push(bullet("Бракує соціальних функцій (стрічка, чат) та емоційної, «ігрової» складової."));

children.push(h2("1.3. Battlefy"));
children.push(p("Майданчик для кіберспортивних змагань (з 2013 р., понад 100 000 проведених турнірів). 100% безкоштовний, має профілі команд/гравців і систему верифікації Battlefy Shield."));
children.push(plain("Недоліки:", {bold:true}));
children.push(bullet("Немає наскрізної «кар'єри» команди між турнірами та гейміфікації."));
children.push(bullet("Візуально нейтральний — нічого, чим хотілося б поділитися."));
children.push(bullet("Орієнтація на масштабні події ускладнює використання для локальних змагань."));

children.push(h2("1.4. Порівняльна таблиця"));
children.push(table([2100,1820,1820,1820,1800],[
  ["Критерій","Challonge","Toornament","Battlefy","Наша платформа"],
  ["Аудиторія","Аматори","Профі-ліги","Спільноти/профі","Друзі та LAN"],
  ["Онбординг","Середній","Складний","Простий","Простий (3 поля)"],
  ["Профіль між турнірами","Немає","Частково","Є","Наскрізний"],
  ["Рейтинг команди","У турнірі","Частково","Профіль","Середній по грі"],
  ["Гейміфікація","Немає","Немає","Немає","RPG-картка"],
  ["Реклама free","Так","Обмежено","Немає","Немає"],
]));
children.push(gap());
children.push(p("Висновок: жоден аналог не поєднує одночасно простий онбординг, персистентний профіль команди та емоційну, шерабельну складову. Саме ця незайнята ніша визначає переваги нашого проєкту."));

// ===== 2. Концепція =====
children.push(h1("2. Формування концепції проєкту"));
children.push(h2("2.1. Суть"));
children.push(p("Веб-застосунок, що дозволяє будь-кому — від компанії друзів до організатора районної LAN-party — створити турнір за хвилину, автоматично отримати турнірну сітку, вести результати в реальному часі та отримати «прокачану» візуалізацію команди у вигляді RPG-картки зі статистикою, рейтингом і складом."));
children.push(h2("2.2. Проблема"));
children.push(bullet("Аматорські турніри ведуть в Excel/блокноті або через громіздкі enterprise-рішення."));
children.push(bullet("Ручне складання сітки на 16+ учасників — рутина і джерело помилок."));
children.push(bullet("Існуючі рішення не дають «відчуття гри» — лише таблиці й дерева матчів."));
children.push(h2("2.3. Ключові переваги"));
children.push(num("Онбординг за хвилину — створення турніру у три поля."));
children.push(num("Персистентний профіль команди з рейтингом між турнірами — «кар'єра», а не одноразова сітка."));
children.push(num("RPG-картка команди з експортом у PNG — безкоштовний віральний механізм просування."));
children.push(num("Автоматична генерація сітки (single/double elimination) з обробкою непарної кількості учасників через «бай»."));
children.push(num("Live-оновлення результатів матчів через WebSocket."));

children.push(h2("2.4. Уточнена модель рейтингу"));
children.push(p("Під час концепції уточнено модель рейтингу: єдиної універсальної шкали між іграми не існує, тому рейтинг команди обчислюється як середнє рейтингів її гравців у рідній одиниці дисципліни."));
children.push(table([3120,3120,3120],[
  ["Дисципліна","Одиниця рейтингу","Приклад"],
  ["CS2","FACEIT ELO","2198"],
  ["Dota 2","MMR","5400"],
  ["Valorant","Звання (Iron–Radiant)","Immortal"],
]));
children.push(gap());
children.push(p("Команди порівнюються в межах однієї дисципліни. Уся гейміфікація реалізується формулами та HTML/CSS-шаблонами без використання ШІ — отже, без витрат на зовнішні API."));

// ===== 3. Архітектура =====
children.push(h1("3. Аналіз архітектури"));
children.push(h2("3.1. Узагальнена архітектура аналогів"));
children.push(p("Сервіси цього класу будуються за класичною клієнт-серверною схемою з поділом на frontend, backend, базу даних і шар реального часу."));
children.push(bullet("Frontend: SPA (React/Vue/Angular), що відмальовує сітки, форми та результати."));
children.push(bullet("Backend: REST API (рідше GraphQL) на Node.js, PHP, Python чи Ruby."));
children.push(bullet("База даних: реляційні СУБД (PostgreSQL/MySQL), деколи кеш (Redis)."));
children.push(bullet("Реальний час: WebSocket або long-polling для оновлення результатів."));

children.push(h2("3.2. Обраний стек та обґрунтування"));
children.push(table([2400,3480,3480],[
  ["Шар","Рішення","Обґрунтування"],
  ["Frontend","React + Vite (JavaScript)","Компонентний підхід, зручний для динамічної сітки та карток"],
  ["Backend","Node.js + Express","Одна мова з фронтендом, швидка розробка, рідний Socket.io"],
  ["База даних","PostgreSQL","Надійна реляційна модель для турнірів і рейтингів"],
  ["Реальний час","WebSocket (Socket.io)","Live-оновлення результатів матчів"],
  ["Генерація карток","html2canvas / Puppeteer","Експорт RPG-картки у зображення"],
]));
children.push(gap());
children.push(p("Розглянуто й альтернативи: Python + FastAPI (теж придатний, але фронт і бек на різних мовах) та Rust (відхилено через крутий поріг входу й надмірність для CRUD-логіки з WebSocket під дедлайн)."));

children.push(h2("3.3. Ключові сутності бази даних"));
children.push(bullet("Team — назва, лого, дисципліна, обчислюваний рейтинг, дата створення."));
children.push(bullet("Player — team_id, нік, роль (залежить від гри), рейтинг у одиниці дисципліни, статус (основа/запас)."));
children.push(bullet("Tournament — назва, формат (single/double elimination), дата, статус."));
children.push(bullet("Match — tournament_id, команда1, команда2, раунд, статус, результат."));
children.push(bullet("Rating/History — історія рейтингу команди для відображення прогресу."));

// ===== 4. UX =====
children.push(h1("4. Аналіз UX та структура сторінок"));
children.push(h2("4.1. UX-спостереження за аналогами"));
children.push(bullet("Сильні сторони: швидке створення сітки (Challonge), гнучке налаштування (Toornament), масштабованість (Battlefy)."));
children.push(bullet("Слабкі сторони: перевантажені форми, багато кроків, застаріла навігація, відсутність єдиного профілю команди та емоційної подачі."));
children.push(bullet("Висновок: мінімізувати кроки до створення турніру, зробити сітку центральним елементом, додати окремий привабливий профіль команди."));

children.push(h2("4.2. Спроєктована структура сторінок"));
children.push(num("Головна — опис сервісу та заклик «Створити турнір»."));
children.push(num("Створення турніру — назва, формат, кількість команд, дисципліна."));
children.push(num("Сторінка турніру — візуалізація сітки з live-оновленням (вкладки: Сітка / Результати / Команди)."));
children.push(num("Команда — реєстрація/редагування: лого, склад, ролі та рейтинги гравців, запасні."));
children.push(num("Профіль команди — картка зі статистикою, складом і рейтингом."));
children.push(num("Загальний рейтинг — таблиця команд з фільтром за дисципліною."));

children.push(h2("4.3. Принципи UX нашого рішення"));
children.push(bullet("Мінімум тексту й зрозумілі підказки: активні елементи виділені, користувач одразу бачить, що натискати."));
children.push(bullet("Ролі гравців і одиниця рейтингу автоматично відповідають обраній грі."));
children.push(bullet("Простий, «ескізний» візуальний стиль зі стриманим акцентом — придатний для подальшого розвитку."));

// ===== 5. Прототип =====
children.push(h1("5. Зведення по прототипу"));
children.push(p("Для перевірки спроєктованої структури сторінок створено робочий прототип-каркас. Він не містить бекенду (його розробка починається на Тижні 2) і працює на демонстраційних даних, але відтворює всю навігацію та ключові інтерактивні сценарії."));
children.push(h2("5.1. Реалізовано"));
children.push(bullet("Усі сторінки зі структури як окремі React-компоненти з маршрутизацією."));
children.push(bullet("Інтерактивна турнірна сітка на 8 команд: введення рахунку, автоматичне просування переможців до фіналу, визначення чемпіона, коректний розподіл «баїв» за стандартним посівом."));
children.push(bullet("Редактор команди: склад і запасні, ролі та рейтинги, що залежать від дисципліни; живий підрахунок середнього рейтингу."));
children.push(bullet("Профіль через картки команд (зі слотом під лого) та загальний рейтинг із фільтром за грою."));
children.push(h2("5.2. Технічний стан"));
children.push(table([3120,6240],[
  ["Складова","Стан"],
  ["Frontend (React + Vite, JS)","Працює, збирається без помилок"],
  ["Backend (Express + Socket.io)","Скелет; повна реалізація — Тиждень 2"],
  ["Дані","Демонстраційні, зібрані в одному модулі для заміни на API"],
]));

// ===== Висновки =====
children.push(h1("Висновки за Тиждень 1"));
children.push(num("Проведено аналіз трьох аналогів, систематизовано недоліки та визначено незайняту нішу."));
children.push(num("Сформовано концепцію та обґрунтовано переваги; уточнено модель рейтингу як середнє по грі."));
children.push(num("Проаналізовано архітектуру аналогів, обрано та обґрунтовано стек і ключові сутності БД."));
children.push(num("Проаналізовано UX і спроєктовано структуру з 6 сторінок, перевірену робочим прототипом."));
children.push(plain("Результати тижня формують фундамент для Тижня 2 — проєктування схеми БД та розробки backend API.", {italics:true}));

// ===== Документ =====
const doc = new Document({
  features:{ updateFields:true },   // Word оновить зміст і нумерацію при відкритті
  styles:{
    default:{ document:{ run:{ font:FONT, size:28, language:{ value:"uk-UA" } } } },
    paragraphStyles:[
      { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ size:30, bold:true, font:FONT, color:"1F3864" },
        paragraph:{ spacing:{before:280,after:160}, outlineLevel:0, keepNext:true } },
      { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
        run:{ size:28, bold:true, font:FONT, color:"2E5496" },
        paragraph:{ spacing:{before:180,after:100}, outlineLevel:1, keepNext:true } },
    ],
  },
  numbering:{ config:[
    { reference:"bullets", levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}] },
    { reference:"nums", levels:[{level:0,format:LevelFormat.DECIMAL,text:"%1.",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}] },
  ]},
  sections:[{
    properties:{ page:{ size:{width:11906,height:16838}, margin:{top:1134,right:1134,bottom:1134,left:1701} } },
    footers:{ default:new Footer({ children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({children:[PageNumber.CURRENT],size:20})] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf=>{ fs.writeFileSync("Звіт_Тиждень_1.docx", buf); console.log("WROTE Звіт_Тиждень_1.docx", buf.length, "bytes"); });
