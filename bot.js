const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment");
require("moment/locale/ru");
moment.locale("ru");

const token = process.env.TOKEN;
const adminId = parseInt(process.env.ADMIN_ID);
const groupChatId = parseInt(process.env.GROUP_CHAT_ID); // основная группа для расписания
const targetGroupId = -4815152987; // группа для автопинга

const bot = new TelegramBot(token, { polling: true });

// ===== Временное хранилище расписания =====
let schedule = {
  odd: {},
  even: {}
};

// ===== Авто-пинг каждую минуту в targetGroupId =====
setInterval(() => {
  bot.sendMessage(targetGroupId, "🤖 Бот активен и следит за расписанием!");
}, 60 * 1000);

// ===== Проверка недели =====
function isOddWeek() {
  const week = moment().week();
  return week % 2 !== 0;
}

// ===== Красивое расписание на день с динамическим переносом =====
function getDaySchedule(dayName, weekType) {
  const maxLineLength = 40; // максимальная длина строки для одной пары
  if (schedule[weekType][dayName] && schedule[weekType][dayName].length > 0) {
    let text = `📌 ${dayName}:\n`;
    schedule[weekType][dayName].forEach((pair, i) => {
      const words = pair.split(" ");
      let line = "";
      let formattedPair = "";
      words.forEach(word => {
        if ((line + word).length > maxLineLength) {
          formattedPair += line + "\n      ";
          line = word + " ";
        } else {
          line += word + " ";
        }
      });
      formattedPair += line.trim();
      text += `   ${i+1}) ${formattedPair}\n`;
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

// ===== /myid =====
bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Твой Telegram ID: ${msg.from.id}`);
});

// ===== /groupid =====
bot.onText(/\/groupid/, (msg) => {
  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    bot.sendMessage(msg.chat.id, `🆔 ID этой группы: ${msg.chat.id}`);
  } else {
    bot.sendMessage(msg.chat.id, "❌ Эта команда работает только в группе.");
  }
});

// ===== /расписание =====
bot.onText(/\/расписание/, (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== groupChatId) return;

  const weekType = isOddWeek() ? "odd" : "even";
  const weekName = isOddWeek() ? "Нечётная" : "Чётная";

  const today = moment().format("dddd");
  const tomorrow = moment().add(1, "days").format("dddd");

  let reply = `📅 Расписание (${weekName} неделя)\n\n`;
  reply += "🟢 Сегодня:\n" + getDaySchedule(today, weekType) + "\n";
  reply += "🟡 Завтра:\n" + getDaySchedule(tomorrow, weekType);

  bot.sendMessage(chatId, reply);
});

// ===== Сообщения =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = msg.from.id === adminId;

  // Главное меню кнопки
  if (msg.text === "📅 Показать расписание") {
    const weekType = isOddWeek() ? "odd" : "even";
    const weekName = isOddWeek() ? "Нечётная" : "Чётная";

    let textReply = `📅 Расписание (${weekName} неделя):\n\n`;
    const days = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
    days.forEach(day => {
      textReply += getDaySchedule(day, weekType) + "\n";
    });
    bot.sendMessage(chatId, textReply);
  }

  // Проверка прав администратора
  if (!isAdmin && ["➕ Добавить пару","✏️ Изменить пару","❌ Удалить пару"].includes(msg.text)) {
    bot.sendMessage(chatId, "❌ Только администратор может изменять расписание");
    return;
  }

  if (msg.text === "✏️ Изменить пару") {
    bot.sendMessage(chatId, "Формат изменения: день; номер пары; новое значение; odd/even");
  }
  if (msg.text === "❌ Удалить пару") {
    bot.sendMessage(chatId, "Формат удаления: день; номер пары; odd/even");
  }
});

// ===== Inline кнопки для добавления пары (пошаговый ввод) =====
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  if (userId !== adminId) {
    bot.sendMessage(chatId, "❌ Только администратор может изменять расписание");
    return;
  }

  if (query.data.startsWith("add_")) {
    const day = query.data.replace("add_", "");
    const pairData = {};

    // Шаг 1: название предмета
    bot.sendMessage(chatId, `✍️ Введите название предмета для ${day}:`);
    bot.once("message", (msg1) => {
      pairData.name = msg1.text;

      // Шаг 2: номер пары
      bot.sendMessage(chatId, `Введите номер пары для ${day} (числом):`);
      bot.once("message", (msg2) => {
        pairData.number = msg2.text;

        // Шаг 3: время
        bot.sendMessage(chatId, `Введите время пары для ${day} (пример: 10:00):`);
        bot.once("message", (msg3) => {
          pairData.time = msg3.text;

          // Шаг 4: неделя
          bot.sendMessage(chatId, `Введите тип недели (odd/нечет или even/чет):`);
          bot.once("message", (msg4) => {
            const weekType = (msg4.text.toLowerCase() === "even" || msg4.text.toLowerCase() === "чет") ? "even" : "odd";

            const pairText = `${pairData.name} (${pairData.time})`;

            if (!schedule[weekType][day]) schedule[weekType][day] = [];
            const index = parseInt(pairData.number) - 1;
            if (!isNaN(index) && index >= 0) {
              schedule[weekType][day].splice(index, 0, pairText);
            } else {
              schedule[weekType][day].push(pairText);
            }

            bot.sendMessage(chatId, `✅ Добавлено в ${day} (${weekType} неделя): ${pairText}`);
            mainMenu(chatId, true);
          });
        });
      });
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