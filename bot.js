const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment");
require("moment/locale/ru");
moment.locale("ru");

const token = "YOUR_TELEGRAM_BOT_TOKEN"; 
const bot = new TelegramBot(token, { polling: true });

// ===== Временное хранилище расписания =====
let schedule = {
  odd: {},
  even: {}
};

// ===== Настройки =====
const adminId = 123456789; // <-- твой Telegram ID
const groupChatId = -1001234567890; // <-- ID группы для авто-рассылки

// ===== Проверка недели =====
function isOddWeek() {
  const week = moment().week();
  return week % 2 !== 0;
}

// ===== Красивое расписание на день =====
function getDaySchedule(dayName, weekType) {
  if (schedule[weekType][dayName] && schedule[weekType][dayName].length > 0) {
    let text = `📌 ${dayName}:\n`;
    schedule[weekType][dayName].forEach((pair, i) => {
      text += `   ${i+1}) ${pair}\n`;
    });
    return text;
  } else {
    return `📌 ${dayName}: занятий нет.\n`;
  }
}

// ===== Главное меню =====
function mainMenu(chatId, isAdmin) {
  const buttons = [["📅 Показать расписание"]];
  if (isAdmin) {
    buttons.push(["➕ Добавить пару", "✏️ Изменить пару"]);
    buttons.push(["❌ Удалить пару"]);
  }
  bot.sendMessage(chatId, "🎓 Главное меню:", {
    reply_markup: { keyboard: buttons, resize_keyboard: true }
  });
}

// ===== /start =====
bot.onText(/\/start/, (msg) => {
  const isAdmin = msg.from.id === adminId;
  bot.sendMessage(msg.chat.id, "Привет! Я бот для расписания МИСИС 📚");
  mainMenu(msg.chat.id, isAdmin);
});

// ===== /myid - узнать свой Telegram ID =====
bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Твой Telegram ID: ${msg.from.id}`);
});

// ===== /groupid - узнать ID группы =====
bot.onText(/\/groupid/, (msg) => {
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    bot.sendMessage(msg.chat.id, `🆔 ID этой группы: ${msg.chat.id}`);
  } else {
    bot.sendMessage(msg.chat.id, "❌ Эта команда работает только в группе.");
  }
});

// ===== Сообщения =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.toLowerCase() : "";
  const isAdmin = msg.from.id === adminId;

  // Ответ на "расписание"
  if (text.includes("расписание")) {
    const weekType = isOddWeek() ? "odd" : "even";
    const weekName = isOddWeek() ? "Нечётная" : "Чётная";

    const today = moment().format("dddd");
    const tomorrow = moment().add(1, "days").format("dddd");

    let reply = `📅 Расписание (${weekName} неделя)\n\n`;
    reply += "🟢 Сегодня:\n" + getDaySchedule(today, weekType) + "\n";
    reply += "🟡 Завтра:\n" + getDaySchedule(tomorrow, weekType);

    bot.sendMessage(chatId, reply);
  }

  // Главное меню кнопки
  if (msg.text === "📅 Показать расписание") {
    const weekType = isOddWeek() ? "odd" : "even";
    const weekName = isOddWeek() ? "Нечётная" : "Чётная";

    let text = `📅 Расписание (${weekName} неделя):\n\n`;
    const days = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
    days.forEach(day => {
      text += getDaySchedule(day, weekType) + "\n";
    });
    bot.sendMessage(chatId, text);
  }

  // Проверка прав администратора для действий
  if (!isAdmin && ["➕ Добавить пару","✏️ Изменить пару","❌ Удалить пару"].includes(msg.text)) {
    bot.sendMessage(chatId, "❌ Только администратор может изменять расписание");
    return;
  }

  // Добавление пары
  if (msg.text === "➕ Добавить пару") {
    bot.sendMessage(chatId, "Выбери день недели:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Понедельник", callback_data: "add_Понедельник" }],
          [{ text: "Вторник", callback_data: "add_Вторник" }],
          [{ text: "Среда", callback_data: "add_Среда" }],
          [{ text: "Четверг", callback_data: "add_Четверг" }],
          [{ text: "Пятница", callback_data: "add_Пятница" }],
          [{ text: "Суббота", callback_data: "add_Суббота" }]
        ]
      }
    });
  }

  // Изменение и удаление через текстовый формат
  if (msg.text === "✏️ Изменить пару") {
    bot.sendMessage(chatId, "Формат изменения: день; номер пары; новое значение; odd/even");
  }
  if (msg.text === "❌ Удалить пару") {
    bot.sendMessage(chatId, "Формат удаления: день; номер пары; odd/even");
  }
});

// ===== Inline кнопки для добавления пары =====
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  if (userId !== adminId) {
    bot.sendMessage(chatId, "❌ Только администратор может изменять расписание");
    return;
  }

  if (query.data.startsWith("add_")) {
    const day = query.data.replace("add_", "");
    bot.sendMessage(chatId, `✍️ Введи пару для ${day}.\nФормат: "Название пары ВРЕМЯ odd/even" (пример: Математика 10:00 odd)`);

    bot.once("message", (reply) => {
      const parts = reply.text.split(" ");
      const type = parts.pop().toLowerCase();
      const weekType = type === "even" ? "even" : "odd";
      const pair = parts.join(" ");

      if (!schedule[weekType][day]) schedule[weekType][day] = [];
      schedule[weekType][day].push(pair);

      bot.sendMessage(chatId, `✅ Добавлено в ${day} (${weekType} неделя): ${pair}`);
      mainMenu(chatId, true);
    });
  }
});

// ===== Авто-рассылка расписания утром =====
const scheduleDaily = () => {
  const weekType = isOddWeek() ? "odd" : "even";
  const weekName = isOddWeek() ? "Нечётная" : "Чётная";

  const today = moment().format("dddd");

  let text = `☀️ Доброе утро! Расписание на сегодня (${weekName} неделя):\n\n`;
  text += getDaySchedule(today, weekType);

  bot.sendMessage(groupChatId, text);
};

// Таймер на 8:00 утра
const now = moment();
let next8 = moment().hour(8).minute(0).second(0);
if (now.isAfter(next8)) next8.add(1, 'day');
const msUntilNext8 = next8.diff(now);

setTimeout(() => {
  scheduleDaily();
  setInterval(scheduleDaily, 24 * 60 * 60 * 1000);
}, msUntilNext8);
