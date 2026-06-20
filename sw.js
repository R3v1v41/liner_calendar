// ====================== 【部署后修改此行】 ======================
const PROXY_BASE = "https://你的Vercel项目名.vercel.app/api/dav-proxy";
const TARGET_FILE_PATH = "线性日历/calendar.json";
// ==============================================================

/**
 * 读取坚果云云端日历数据
 */
async function loadCalendar() {
  try {
    const reqUrl = `${PROXY_BASE}?file=${encodeURIComponent(TARGET_FILE_PATH)}`;
    const resp = await fetch(reqUrl);
    if (!resp.ok) throw new Error(`请求异常，状态码：${resp.status}`);
    const data = await resp.json();
    console.log("云端日程加载成功", data);
    return data;
  } catch (err) {
    console.error("读取云端失败：", err);
    alert(`读取云端数据失败：${err.message}`);
    return null;
  }
}

/**
 * 保存日历数据到坚果云
 * @param {Object} calendarAllData 完整日历json对象
 * @returns {boolean} 保存成功true / 失败false
 */
async function saveCalendar(calendarAllData) {
  try {
    const reqUrl = `${PROXY_BASE}?file=${encodeURIComponent(TARGET_FILE_PATH)}`;
    const resp = await fetch(reqUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(calendarAllData)
    });
    if (!resp.ok) throw new Error(`请求异常，状态码：${resp.status}`);
    alert("✅ 日程同步保存至坚果云成功");
    return true;
  } catch (err) {
    console.error("保存云端失败：", err);
    alert(`同步保存失败：${err.message}`);
    return false;
  }
}

// ====================== 页面加载初始化调用示例 ======================
window.onload = async function () {
  console.log("年度线性日历已加载！");
  // 拉取云端数据
  const cloudCalendar = await loadCalendar();
  if (cloudCalendar) {
    // 此处保留你原有渲染日历的代码
    renderCalendar(cloudCalendar);
  } else {
    // 云端无数据，初始化空白日历
    initEmptyCalendar();
  }
};

// ====================== 保存按钮点击事件示例 ======================
// 将 #save-btn 替换为你页面实际保存按钮id
document.querySelector("#save-btn").addEventListener("click", async function () {
  // 获取页面全部日程数据（保留你原有获取数据的方法）
  const fullData = getAllCalendarData();
  const syncSuccess = await saveCalendar(fullData);
  if (syncSuccess) {
    // 保存成功后刷新页面日程列表逻辑
    refreshEventList();
  }
});
