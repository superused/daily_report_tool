var date = new Date();

var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('config');
var from    = sheet.getRange("C2").getValue();
var to      = sheet.getRange("D2").getValue();
var cc      = sheet.getRange("E2").getValue();

var mailType = '日報';
var name1 = sheet.getRange("A2").getValue();
var name2 = sheet.getRange("B2").getValue();
var jobun = sheet.getRange("F2").getValue()
    .replace(/%name%/g, name1)
    .replace(/%date%/g, getDate())
    .replace(/%type%/g, mailType);
var startTime = sheet.getRange("G2").getValue();
var start = [startTime.getHours(), startTime.getMinutes()];
var endTime = sheet.getRange("H2").getValue();
var end = [endTime.getHours(), endTime.getMinutes()];

var breakTime = sheet.getRange("I2").getValue();
var signature = sheet.getRange("J2").getValue();

var sender = name1 + name2; //差出人

var kinmuUrl = sheet.getRange("K2").getValue();

/**
 * 表示処理
 */
function doGet(request) {
  if (request.parameters.t == 'weekly') {
    mailType = '週報';
    jobun = sheet.getRange("F2").getValue()
      .replace(/%name%/g, name1)
      .replace(/%date%/g, (date.getDay() > 4) ? '今週' : '先週')
      .replace(/%type%/g, mailType);
    var ccArr = cc.split(',');
    var toArr = to.split(',');
    for (var i in ccArr) if (ccArr[i].indexOf('+daily') >= 0) ccArr[i] = ccArr[i].replace(/\+daily/g, '+weekly');
    for (var i in toArr) if (toArr[i].indexOf('+daily') >= 0) toArr[i] = toArr[i].replace(/\+daily/g, '+weekly');
    cc = ccArr.join(',');
    to = toArr.join(',');
    var output = HtmlService.createTemplateFromFile("weekly.html");
    output = makeOutput(output);
  } else if (request.parameters.t == 'culture') {
    var output = HtmlService.createTemplateFromFile("culture.html");
  } else if (request.parameters.t == 'dailylog') {
    var output = HtmlService.createTemplateFromFile("dailylog.html");
    output.datas = getDailyDatas();
  } else if (request.parameters.t == 'weeklylog') {
    var output = HtmlService.createTemplateFromFile("weeklylog.html");
    output.datas = getWeeklyDatas();
  } else if (request.parameters.t == 'config') {
    var output = HtmlService.createTemplateFromFile("config.html");
    output.signature = signature;
    output.name1 = name1;
    output.name2 = name2;
    output.jobun = sheet.getRange("F2").getValue();
    output = makeOutput(output);
  } else {
    var output = HtmlService.createTemplateFromFile("daily.html");
    output = makeOutput(output);
  }
  output.url = ScriptApp.getService().getUrl();
  return output.evaluate();
}

function getWeeklyDatas() {
  var weeklyData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('weekly_data');
  var datas = weeklyData.getRange('A2:I' + weeklyData.getLastRow()).getValues();
  for (var i in datas) {
    for (var j in datas[i]) {
      if (j == 0) {
        datas[i][j] = getDate(datas[i][j]);
      }
      datas[i][j] = htmlspecialchars(datas[i][j]);
    }
  }
  datas.reverse();
  return datas;
}

function getDailyDatas() {
  var dailyData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('daily_data');
  var datas = dailyData.getRange('A2:L' + dailyData.getLastRow()).getValues();
  for (var i in datas) {
    for (var j in datas[i]) {
      if (j == 0) {
        datas[i][j] = getDate(datas[i][j]);
      } else if (['4','5','6'].indexOf(j) >= 0) {
        datas[i][j] = getFullTime(datas[i][j]);
      }
      datas[i][j] = htmlspecialchars(datas[i][j]);
    }
  }
  datas.reverse();
  return datas;
}

function makeOutput(output) {
  output.date = getFullDate();
  output.to = to;
  output.from = from;
  output.cc = cc;
  output.sender = sender;
  output.subject = getSubject();
  output.honbun = getHonbun();
  output.start = start;
  output.end = end;
  output.breakTime = breakTime;
  return output;
}

function saveConfig(data) {
  var values = [[data.name1, data.name2, data.from, data.to, data.cc, data.jobun, data.start, data.end, data.breakTime, data.signature]];
  sheet.getRange("A2:J2").setValues(values);
}

function sendMail(data) {
  var opt = {
    from: data.from,
    name: data.sender,
  };
  if (data.cc) opt.cc = data.cc;
  if (data.bcc) opt.bcc = data.bcc;
  // 署名を追加
  data.honbun = data.honbun + "\n\n" + signature;
  GmailApp.sendEmail(data.to, data.subject, data.honbun, opt);
  appendEventLog(data);
}

/**
 * 日付の値を取得(MM/DD形式)
 */
function getDate(d) {
  if (!d) d = date;
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/**
 * 日付の値を取得(YYYY-MM-DD形式)
 */
function getFullDate(d) {
  if (!d) d = date;
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function getSubjectDate(d) {
  if (!d) d = date;
  return (d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2));
}

function getFullTime(d) {
  if (!d) d = date;
  return ('0' + (d.getHours())).slice(-2) + ':' + ('0' + (d.getMinutes())).slice(-2);
}

/**
 * 最初の文を取得
 */
function getHonbun() {
  var body = jobun;
  return body;
}

function getSubject(d) {
  if (!d) d = date;
  return mailType + "_" + name1 + name2 + '_' + getSubjectDate(d);
}

/**
 * スプレッドシートにテキストを追加記述
 */
function appendEventLog(data) {
  // シート取得
  var sheetData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName((data.pageType == 'weekly') ? 'weekly_data' : 'daily_data');
  // データ入力
  if (data.pageType == 'weekly') {
    sheetData.appendRow([getFullDate(), data.from, data.to, data.cc, data.goal, data.good, data.bad, data.other, data.workTimeWeekly]);
  } else {
    sheetData.appendRow([getFullDate(new Date(data.date)), data.from, data.to, data.cc, data.start, data.end, data.workTime, data.kiroku, data.good, data.bad, data.other, data.remarks]);
    var startArr = data.start.split(':');
    var endArr = data.end.split(':');
    writeKinmuSheet(startArr[0], startArr[1], endArr[0], endArr[1], data.breakTime, data.remarks, new Date(data.date))
  }
  // sheet.appendRow([getHidukeTime(new date(event.timestamp)), event.type, event.source.userId, JSON.stringify(event)]);
}

function getLastRowValues() {
  var dailyData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('daily_data');
  var last = dailyData.getLastRow();
  var workTime       = dailyData.getRange(last, 7).getValue();
  workTime = workTime.getHours() * 60 + workTime.getMinutes();
  var values = {};
  values.from        = dailyData.getRange(last, 2).getValue();
  values.to          = dailyData.getRange(last, 3).getValue();
  values.cc          = dailyData.getRange(last, 4).getValue();
  values.startHour   = dailyData.getRange(last, 5).getValue().getHours();
  values.startMinute = dailyData.getRange(last, 5).getValue().getMinutes();
  values.endHour     = dailyData.getRange(last, 6).getValue().getHours();
  values.endMinute   = dailyData.getRange(last, 6).getValue().getMinutes();
  values.kiroku      = dailyData.getRange(last, 8).getValue();
  values.good        = dailyData.getRange(last, 9).getValue();
  values.bad         = dailyData.getRange(last,10).getValue();
  values.other       = dailyData.getRange(last,11).getValue();
  values.remarks     = dailyData.getRange(last,12).getValue();
  values.breakTime   = (values.endHour * 60 + values.endMinute) - (values.startHour * 60 + values.startMinute) - workTime;
  return values;
}

function getWorkTimeWeekly() {
  var dt = new Date();
  var day = dt.getDay();
  if (day <= 4) {
    dt.setDate(dt.getDate() - day - 7);
  } else {
    dt.setDate(dt.getDate() - day);
  }
  var weekDate = [];
  var result = {};
  for (var i = 0; i < 7; i++) {
    var fullDate = getFullDate(dt);
    weekDate.push(fullDate);
    result[fullDate] = {
      start   : '--:--',
      end     : '--:--',
      workTime: '--:--',
      remarks : '',
    };
    dt.setDate(dt.getDate() + 1);
  }
  var dailyData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('daily_data');
  var last = dailyData.getLastRow();
  var start = last - 10;
  if (start < 2) start = 2;
  for (var i = start; i <= last; i++) {
    var value = getFullDate(dailyData.getRange(i,1).getValue());
    var index = weekDate.indexOf(value);
    if (index >= 0) {
      var start    = dailyData.getRange(i, 5).getValue();
      var end      = dailyData.getRange(i, 6).getValue();
      var workTime = dailyData.getRange(i, 7).getValue();
      var remarks  = dailyData.getRange(i,12).getValue();
      result[value] = {
        start   : getFullTime(start),
        end     : getFullTime(end),
        workTime: getFullTime(workTime),
        remarks : remarks,
      };
    }
  }
  var text = '';
  var youbi = ['日', '月', '火', '水', '木', '金', '土'];
  var cnt = 0;
  for (var r in result) {
    var hiduke = r.split('-');
    text += ('0' + hiduke[1]).slice(-2) + '/' + ('0' + hiduke[2]).slice(-2) + ' ' + youbi[cnt] + ' ' + result[r].start + ' ' + result[r].end + ' ' + result[r].workTime + "　" + result[r].remarks + "\n";
    cnt++;
  }
  return text;
}

/**
 * 勤務表シートに書き込み
 */
function writeKinmuSheet(startHour, startMinute, endHour, endMinute, breakTime, remarks, date) {
  var year = ('' + date.getFullYear()).slice(-2);
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = date.getDate();
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(kinmuUrl);
    var sheet = spreadsheet.getSheetByName(year + month);
    var dates = sheet.getRange("A3:A64").getValues();
    var rowNum = 3;
    for (var i in dates) {
      if (day == dates[i][0]) {
        sheet.getRange('C' + rowNum).setValue('出勤');
        sheet.getRange('G' + rowNum).setValue(remarks);
        sheet.getRange('L' + rowNum + ':' + 'P' + rowNum).setValues([[startHour, startMinute, endHour, endMinute, breakTime]]);
        break;
      }
      rowNum++;
    }
  } catch (e) {
    return false;
  }
}

/**
 * 日報、週報シート編集分を書き込み
 */
function writeSpreadSheetLog(str, cell, type) {
  try {
    if (type == 'dailylog') {
      var sheetName = 'daily_data';
    } else if (type == 'weeklylog') {
      var sheetName = 'weekly_data';
    } else {
      return false;
    }
    var sheetData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    sheetData.getRange(cell).setValue(str);
    return true;
  } catch (e) {
    return false;
  }
}

function getChangeDateText(d) {
  if (!d) {
    d = date;
  } else {
    d = d.split('/');
    d = new Date(d[0], parseInt(d[1]) - 1, d[2]);
  }
  var jobun2 = sheet.getRange("F2").getValue()
    .replace(/%name%/g, name1)
    .replace(/%date%/g, getDate(d))
    .replace(/%type%/g, mailType);
  
  return {
    honbun: jobun2,
    subject: getSubject(d)
  };
}

function htmlspecialchars(str){
  return (str + '').replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;'); 
}

function nl2br(str) {
  var res = str.replace(/\r\n/g, "<br />");
  res = res.replace(/(\n|\r)/g, "<br />");
  return res;
}