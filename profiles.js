/* profiles.js — модели линии Б3-34 и таблица кодов команд.
   Проект pmk52, 24.11.2026. Ревизия 3.

   Линия этого проекта: Б3-34 → МК-54 → МК-52 → ext52.
   Профиль МК-61 сюда НЕ входит: линия 61-го живёт отдельно,
   в проекте greagre/pmk61. Не добавлять, иначе профиль окажется
   в двух местах и версии разойдутся.

   Источник таблицы кодов: руководство по эксплуатации Б3-34 / МК-52 / МК-54 / МК-61
   и документ «Недокументированные возможности», приложение «Все команды»
   (Анваров С.Р., greagre/pmk-android/instruction).

   В таблицу входят ТОЛЬКО документированные команды.
   Недокументированное (адреса-«циклы» A5…F9, регистр X2, «плохой ЕГГ0Г»,
   шестнадцатеричная арифметика) в профили не включено и включаться не должно:
   иначе эмулятор перестанет быть точным.

   Принцип: команда, которой нет в таблице модели, не выполняется —
   она помечается как неизвестная, а не додумывается.

   РЕВИЗИЯ 3 (что изменилось и почему):
   1. Адрес выше 99 записывается как «•» в ПЕРВОЙ ячейке и цифра 0…4 во второй
      (было: «A0» одной ячейкой). Формат отображения — -0…-4.
      В профилях для этого теперь есть addrHighFirst / addrHighLast:
      без них formatAddr вырождался в «--».
   2. progLen у МК-52 = 105: 512 — объём ППЗУ (внешние модули), а не программы.
   3. parseAddr понимает и новый «-4», и старый «A4» — чтобы ранее
      сохранённые тексты не ломались.
*/
(function (global) {
  'use strict';

  var NOP = 0x54; // К НОП — документированный пустой оператор

  // Регистры кодируются одной шестнадцатеричной цифрой: 0…9, A…E = Ra…Re.
  // Цифра F в командах 4F/6F и т.п. означает R0.
  var REG_CHARS = '0123456789ABCDE';

  /* ------------------------------------------------------------------ */
  /* Таблица кодов                                                       */
  /* ------------------------------------------------------------------ */

  var CMD = [];

  function put(code, name, extra) {
    var o = extra || {};
    o.code = code;
    o.name = name;
    o.arg = o.arg || null;   // 'digit' | 'reg' | 'addr' | null
    o.double = !!o.double;   // команда занимает две ячейки (команда + адрес)
    o.hidden = !!o.hidden;   // обычным образом с клавиатуры не вводится
    o.error = !!o.error;     // на ПМК даёт ЕГГ0Г
    CMD[code] = o;
    return o;
  }

  // 00…09 — цифры
  for (var d = 0; d < 10; d++) {
    put(d, 'цифра ' + d, { arg: 'digit', digit: d });
  }

  put(0x0A, '.', { arg: 'digit' });          // разделитель целой и дробной части
  put(0x0B, '/-/');                          // смена знака
  put(0x0C, 'ВП');                           // ввод порядка
  put(0x0D, 'Cx', { hint: 'сброс X, стек не двигается' });
  put(0x0E, 'В↑', { hint: 'сдвиг стека, T теряется' });
  put(0x0F, 'F Вx', { hint: 'полный сдвиг, включая X1' });

  put(0x10, '+');
  put(0x11, '−');
  put(0x12, '×');
  put(0x13, '÷');
  put(0x14, '↔', { hint: 'обмен X и Y' });
  put(0x15, 'F 10^x');
  put(0x16, 'F e^x');
  put(0x17, 'F lg');
  put(0x18, 'F ln');
  put(0x19, 'F sin⁻¹');
  put(0x1A, 'F cos⁻¹');
  put(0x1B, 'F tg⁻¹');
  put(0x1C, 'F sin');
  put(0x1D, 'F cos');
  put(0x1E, 'F tg');
  put(0x1F, 'пустой оператор', { hidden: true });

  put(0x20, 'F π', { hint: 'сдвигает стек и копирует X в X1' });
  put(0x21, 'F √');
  put(0x22, 'F x²', { hint: 'в приложении «Все команды» код 21 указан дважды — верно 22' });
  put(0x23, 'F 1/x');
  put(0x24, 'F x^y', { hint: 'стек НЕ сокращается: Y остаётся на месте' });
  put(0x25, 'F ↔', { hint: 'подтягивание стека' });
  put(0x26, 'K °→′');
  put(0x27, 'K −', { error: true });
  put(0x28, 'K ×', { error: true });
  put(0x29, 'K ÷', { error: true });
  put(0x2A, 'K °→′″');
  put(0x2B, 'ошибка', { error: true });
  put(0x2C, 'ошибка', { error: true });
  put(0x2D, 'ошибка', { error: true });
  put(0x2E, 'ошибка', { error: true });
  put(0x2F, 'пустой оператор', { hidden: true });

  put(0x30, 'K °←′″');
  put(0x31, 'K |x|');
  put(0x32, 'K ЗН');
  put(0x33, 'K °←′');
  put(0x34, 'K [x]', { hint: 'отбрасывание дробной части: [-1,2] = -1' });
  put(0x35, 'K {x}', { hint: 'отбрасывание целой части: {-1,2} = -0,2' });
  put(0x36, 'K max', { hint: 'ноль считается самым большим числом' });
  put(0x37, 'K AND', { hint: 'первая цифра мантиссы заменяется на 8, стек не сокращается' });
  put(0x38, 'K OR');
  put(0x39, 'K XOR');
  put(0x3A, 'K ИНВ');
  put(0x3B, 'K СЧ', { hint: 'датчик случайных чисел: 0 и 1 не выпадают' });
  put(0x3C, 'ошибка', { error: true });
  put(0x3D, 'то же, что K °→′″ (2A)');
  put(0x3E, 'Y→X', { hint: 'копирование Y в X, при этом X→X1' });
  put(0x3F, 'пустой оператор', { hidden: true });

  put(0x50, 'С/П', { hint: 'стоп/пуск' });
  put(0x51, 'БП', { arg: 'addr', double: true });
  put(0x52, 'В/О', { hint: 'возврат: адрес = верхняя ячейка стека + 1' });
  put(0x53, 'ПП', { arg: 'addr', double: true });
  put(0x54, 'К НОП');
  put(0x55, 'К 1');
  put(0x56, 'К 2');
  put(0x57, 'F x≠0', { arg: 'addr', double: true, hint: 'условие выполнено → пропуск адреса' });
  put(0x58, 'F L2', { arg: 'addr', double: true });
  put(0x59, 'F x≥0', { arg: 'addr', double: true, hint: 'условие выполнено → пропуск адреса' });
  put(0x5A, 'F L3', { arg: 'addr', double: true });
  put(0x5B, 'F L1', { arg: 'addr', double: true });
  put(0x5C, 'F x<0', { arg: 'addr', double: true, hint: 'условие выполнено → пропуск адреса' });
  put(0x5D, 'F L0', { arg: 'addr', double: true });
  put(0x5E, 'F x=0', { arg: 'addr', double: true, hint: 'условие выполнено → пропуск адреса' });
  put(0x5F, 'зависание', { hidden: true });

  // Регистровые и адресные диапазоны. Низкая цифра — номер регистра,
  // F означает R0 (команды с F обычным образом не вводятся).
  var RANGES = [
    { hi: 0x40, name: 'x→П',  arg: 'reg',  kind: 'store' },
    { hi: 0x60, name: 'П→x',  arg: 'reg',  kind: 'load' },
    { hi: 0x70, name: 'K x≠0', arg: 'reg', kind: 'condIndirect' },
    { hi: 0x80, name: 'K БП', arg: 'reg',  kind: 'jumpIndirect' },
    { hi: 0x90, name: 'K x≥0', arg: 'reg', kind: 'condIndirect' },
    { hi: 0xA0, name: 'K ПП', arg: 'reg',  kind: 'callIndirect' },
    { hi: 0xB0, name: 'K x→П', arg: 'reg', kind: 'storeIndirect' },
    { hi: 0xC0, name: 'K x<0', arg: 'reg', kind: 'condIndirect' },
    { hi: 0xD0, name: 'K П→x', arg: 'reg', kind: 'loadIndirect' },
    { hi: 0xE0, name: 'K x=0', arg: 'reg', kind: 'condIndirect' }
  ];

  for (var r = 0; r < RANGES.length; r++) {
    var rg = RANGES[r];
    for (var lo = 0; lo < 16; lo++) {
      var code = rg.hi + lo;
      var isF = (lo === 0x0F);
      var regChar = isF ? '0' : REG_CHARS.charAt(lo);
      put(code, rg.name + ' R' + regChar, {
        arg: rg.arg,
        kind: rg.kind,
        reg: isF ? 0 : lo,
        indirect: (rg.hi >= 0x70),
        hidden: isF
      });
    }
  }

  // F0…FF — пустой оператор, обычным образом не вводятся
  for (var f = 0xF0; f <= 0xFF; f++) {
    put(f, 'пустой оператор', { hidden: true });
  }

  /* ------------------------------------------------------------------ */
  /* Модели линии Б3-34                                                  */
  /* ------------------------------------------------------------------ */

  // Общий предел старших адресов линии 34: 100…104 = «•» + цифра.
  var ADDR_HIGH_FIRST = 100;
  var ADDR_HIGH_LAST = 104;

  var PROFILES = {
    'b3-34': {
      id: 'b3-34',
      title: 'Б3-34',
      family: 'Б3-34',
      progLen: 98,
      regCount: 14,
      maxDig: 8,
      nop: NOP,
      indirect: true,
      addrHigh: false,
      notes: 'Базовая модель. МК-54 полностью совпадает по системе команд и памяти.'
    },
    'mk-54': {
      id: 'mk-54',
      title: 'МК-54',
      family: 'Б3-34',
      progLen: 98,
      regCount: 14,
      maxDig: 8,
      nop: NOP,
      indirect: true,
      addrHigh: false,
      notes: 'То же, что Б3-34: те же коды, 98 шагов, 14 регистров.'
    },
    'mk-52': {
      id: 'mk-52',
      title: 'МК-52',
      family: 'Б3-34',
      // 512 — это объём ППЗУ (внешние модули), а не программной памяти.
      // Сама программа — те же 105 шагов, что и у линии 34.
      progLen: 105,
      regCount: 15,
      maxDig: 8,
      nop: NOP,
      indirect: true,
      addrHigh: true,
      addrHighFirst: ADDR_HIGH_FIRST,
      addrHighLast: ADDR_HIGH_LAST,
      addrNote: 'адреса 100…104 задаются «•» в первой ячейке и цифрой 0…4 во второй',
      regNote: 'число регистров уточнить по руководству',
      notes: 'Заводское расширение линии Б3-34: те же команды, адреса до 104, ' +
             'поддерживает внешние модули ППЗУ.'
    },
    'ext52': {
      id: 'ext52',
      title: 'EXT52 (наш профиль)',
      family: 'EXT',
      experimental: true,
      progLen: 512,
      regCount: 15,
      regBanks: 4,
      maxDig: 8,
      nop: NOP,
      indirect: true,
      addrHigh: true,
      addrHighFirst: ADDR_HIGH_FIRST,
      addrHighLast: ADDR_HIGH_LAST,
      addrNote: 'способ адресации выше 99 не утверждён: страницы либо двухбайтовый адрес',
      notes: 'Наша импровизация как продолжение линии Б3-34, а не историческая модель. ' +
             'Планируется: банки регистров, страницы программной памяти, блоки ППЗУ. ' +
             'Формат новых команд не утверждён — в интерфейс пока не выводить.'
    }
  };

  /* ------------------------------------------------------------------ */
  /* Вспомогательные функции                                             */
  /* ------------------------------------------------------------------ */

  var DEFAULT_MODEL = 'b3-34';

  function cmd(code) {
    return CMD[code & 0xFF] || null;
  }

  function name(code) {
    var c = cmd(code);
    return c ? c.name : 'неизвестная команда';
  }

  function isDouble(code) {
    var c = cmd(code);
    return !!(c && c.double);
  }

  function isIndirect(code) {
    var c = cmd(code);
    return !!(c && c.indirect);
  }

  function isHidden(code) {
    var c = cmd(code);
    return !!(c && c.hidden);
  }

  function isError(code) {
    var c = cmd(code);
    return !!(c && c.error);
  }

  // Для 4r/6r и косвенных: номер регистра из младшей цифры кода
  function registerIndex(code) {
    var c = cmd(code);
    return (c && typeof c.reg === 'number') ? c.reg : null;
  }

  // Адрес линии 34: 00…99, а при addrHigh — ещё и 100…104.
  // Запись старшего адреса: «•4» в команде, отображение: «-4».
  function formatAddr(n, model) {
    var p = PROFILES[model] || PROFILES[DEFAULT_MODEL];
    if (typeof n !== 'number' || !isFinite(n)) return '--';
    n = Math.round(n);
    if (n < 0) return '--';
    if (n < 100) return (n < 10 ? '0' : '') + n;
    if (p.addrHigh &&
        typeof p.addrHighFirst === 'number' &&
        typeof p.addrHighLast === 'number' &&
        n >= p.addrHighFirst && n <= p.addrHighLast) {
      return '-' + (n - p.addrHighFirst);
    }
    return '--';
  }

  function parseAddr(text, model) {
    var s = String(text == null ? '' : text).replace(/\s+/g, '').toUpperCase();
    var p = PROFILES[model] || PROFILES[DEFAULT_MODEL];
    var high = (p.addrHigh &&
                typeof p.addrHighFirst === 'number' &&
                typeof p.addrHighLast === 'number');

    if (/^\d{1,2}$/.test(s)) {
      var v = parseInt(s, 10);
      return v <= 99 ? v : null;
    }
    if (!high) return null;

    // Новый вид: -0…-4. Старый: A0…A4 (и •0…•4 на всякий случай).
    if (/^[-−•A]\d$/.test(s)) {
      var n = p.addrHighFirst + parseInt(s.charAt(1), 10);
      return n <= p.addrHighLast ? n : null;
    }
    return null;
  }

  function get(id) {
    return PROFILES[id] || null;
  }

  function list() {
    var out = [];
    for (var k in PROFILES) {
      if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out.push(PROFILES[k]);
    }
    return out;
  }

  // Модели для вывода в интерфейсе (без экспериментальных)
  function listStable() {
    return list().filter(function (p) { return !p.experimental; });
  }

  // Проверка «команда допустима в этой модели»
  function allowed(code, model) {
    var p = get(model);
    if (!p) return true;
    if (!p.indirect && isIndirect(code)) return false;
    return true;
  }

  var MKProfiles = {
    NOP: NOP,
    REG_CHARS: REG_CHARS,
    DEFAULT_MODEL: DEFAULT_MODEL,
    ADDR_HIGH_FIRST: ADDR_HIGH_FIRST,
    ADDR_HIGH_LAST: ADDR_HIGH_LAST,
    PROFILES: PROFILES,
    get: get,
    list: list,
    listStable: listStable,
    cmd: cmd,
    name: name,
    isDouble: isDouble,
    isIndirect: isIndirect,
    isHidden: isHidden,
    isError: isError,
    registerIndex: registerIndex,
    formatAddr: formatAddr,
    parseAddr: parseAddr,
    allowed: allowed
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MKProfiles;
  } else {
    global.MKProfiles = MKProfiles;
  }
}(typeof window !== 'undefined' ? window : this));
