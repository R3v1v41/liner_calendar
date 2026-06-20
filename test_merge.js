// 核心算法测试
var passed = 0, failed = 0;

function generateId() { return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 6); }
function getNowISO() { return new Date().toISOString(); }

function mergeTasksMultiDevice(cloudTasks, localTasks) {
    var taskMap = {};
    var now = getNowISO();
    var conflicts = [];

    function normalize(task, source) {
        var t = JSON.parse(JSON.stringify(task));
        if (!t.updatedAt) t.updatedAt = now;
        if (t.deleted === undefined) t.deleted = false;
        if (t.text === undefined) t.text = "";
        if (!t.color) t.color = "pink";
        if (!t.createdBy) t.createdBy = source || "unknown";
        if (!t.version) t.version = 1;
        return t;
    }

    localTasks.forEach(function(t) {
        if (t && t.id && t.startDate && t.endDate) {
            var task = normalize(t, t.createdBy || "local");
            taskMap[task.id] = { task: task, source: "local" };
        }
    });

    cloudTasks.forEach(function(t) {
        if (t && t.id && t.startDate && t.endDate) {
            var cloudTask = normalize(t, t.createdBy || "cloud");
            if (!taskMap[cloudTask.id]) {
                taskMap[cloudTask.id] = { task: cloudTask, source: "cloud" };
            } else {
                var existing = taskMap[cloudTask.id];
                var localTask = existing.task;

                if (cloudTask.deleted && !localTask.deleted) {
                    taskMap[cloudTask.id] = { task: cloudTask, source: "cloud-deleted" };
                    return;
                }
                if (localTask.deleted && !cloudTask.deleted) {
                    taskMap[cloudTask.id] = { task: localTask, source: "local-deleted" };
                    return;
                }
                if (cloudTask.deleted && localTask.deleted) {
                    var cTimeD = new Date(cloudTask.updatedAt).getTime();
                    var lTimeD = new Date(localTask.updatedAt).getTime();
                    taskMap[cloudTask.id] = { task: (cTimeD > lTimeD ? cloudTask : localTask), source: "both-deleted" };
                    return;
                }

                var cVer = cloudTask.version || 0;
                var lVer = localTask.version || 0;
                var cTime = new Date(cloudTask.updatedAt).getTime();
                var lTime = new Date(localTask.updatedAt).getTime();
                if (isNaN(cTime)) cTime = 0;
                if (isNaN(lTime)) lTime = 0;

                if (cloudTask.updatedBy === localTask.updatedBy) {
                    if (cVer > lVer || (cVer === lVer && cTime > lTime)) {
                        taskMap[cloudTask.id] = { task: cloudTask, source: "cloud-newer" };
                    }
                    return;
                }

                if (cTime > lTime) {
                    conflicts.push({ id: cloudTask.id, winner: "cloud" });
                    taskMap[cloudTask.id] = { task: cloudTask, source: "cloud-wins" };
                } else if (lTime > cTime) {
                    conflicts.push({ id: localTask.id, winner: "local" });
                    taskMap[cloudTask.id] = { task: localTask, source: "local-wins" };
                } else {
                    if (cVer > lVer) {
                        taskMap[cloudTask.id] = { task: cloudTask, source: "cloud-ver" };
                    } else {
                        taskMap[cloudTask.id] = { task: localTask, source: "local-ver" };
                    }
                }
            }
        }
    });

    var result = [];
    for (var key in taskMap) {
        if (taskMap.hasOwnProperty(key)) {
            var item = taskMap[key].task;
            if (item.deleted === true) continue;
            delete item._conflict;
            delete item._cloudBy;
            delete item._localBy;
            result.push(item);
        }
    }
    return { tasks: result, conflicts: conflicts };
}

function makeTask(dev, text, start, end, color, version) {
    return {
        id: generateId(), text: text, startDate: start, endDate: end,
        color: color || "pink", createdAt: getNowISO(), updatedAt: getNowISO(),
        createdBy: dev, updatedBy: dev, version: version || 1, deleted: false
    };
}

function check(name, condition, detail) {
    if (condition) { console.log("PASS: " + name); passed++; }
    else { console.log("FAIL: " + name + " - " + detail); failed++; }
}

// TEST 1
console.log("=== TEST 1: 独立任务合并 ===");
var r1 = mergeTasksMultiDevice(
    [makeTask("A","A1","2026-01-01","2026-01-03","blue",1), makeTask("A","A2","2026-02-01","2026-02-03","mint",1)],
    [makeTask("B","B1","2026-03-01","2026-03-03","pink",1), makeTask("B","B2","2026-04-01","2026-04-03","coral",1)]
);
check("4条全部保留", r1.tasks.length === 4, "期望4条,实际"+r1.tasks.length);

// TEST 2
console.log("\n=== TEST 2: 本地为空不丢云端 ===");
var r2 = mergeTasksMultiDevice([makeTask("A","重要","2026-06-01","2026-06-05","blue",1)], []);
check("云端数据保留", r2.tasks.length === 1 && r2.tasks[0].text === "重要", "数据丢失");

// TEST 3
console.log("\n=== TEST 3: 同ID冲突-新时间胜 ===");
var sid = "shared_001";
var oldT = { id: sid, text: "旧", startDate: "2026-06-21", endDate: "2026-06-25", color: "blue", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-20T10:00:00Z", createdBy: "A", updatedBy: "A", version: 1, deleted: false };
var newT = { id: sid, text: "新", startDate: "2026-06-21", endDate: "2026-06-28", color: "coral", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-20T12:00:00Z", createdBy: "B", updatedBy: "B", version: 1, deleted: false };
var r3 = mergeTasksMultiDevice([newT], [oldT]);
check("新版本获胜", r3.tasks.length === 1 && r3.tasks[0].text === "新", "期望新,实际:"+(r3.tasks[0]?r3.tasks[0].text:"无"));

// TEST 4
console.log("\n=== TEST 4: 已删除过滤 ===");
var delT = { id: "del_001", text: "X", startDate: "2026-06-21", endDate: "2026-06-25", color: "blue", createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-21T10:00:00Z", createdBy: "A", updatedBy: "A", version: 2, deleted: true };
var r4 = mergeTasksMultiDevice([delT], [makeTask("B","正常","2026-07-01","2026-07-03","mint",1)]);
check("删除过滤", r4.tasks.length === 1 && !r4.tasks[0].deleted, "未过滤");

// TEST 5
console.log("\n=== TEST 5: 4设备合并 ===");
var devs = ["A","B","C","D"];
var all = [];
devs.forEach(function(d,i) {
    all.push(makeTask(d,d+"-1","2026-0"+(i+1)+"-01","2026-0"+(i+1)+"-05","blue",1));
    all.push(makeTask(d,d+"-2","2026-0"+(i+1)+"-10","2026-0"+(i+1)+"-15","pink",1));
});
var cloud = [];
for (var i=0;i<devs.length;i++) {
    cloud = mergeTasksMultiDevice(cloud, all.filter(function(t){return t.createdBy===devs[i];})).tasks;
}
check("4设备x2=8条", cloud.length === 8, "期望8,实际"+cloud.length);

// TEST 6
console.log("\n=== TEST 6: 双方空 ===");
check("空合并", mergeTasksMultiDevice([],[]).tasks.length===0, "");

// TEST 7
console.log("\n=== TEST 7: 同设备高版本胜 ===");
var sid2 = "same_001";
var v1 = { id:sid2, text:"v1", startDate:"2026-06-21", endDate:"2026-06-25", color:"blue", createdAt:"2026-06-01T00:00:00Z", updatedAt:"2026-06-20T10:00:00Z", createdBy:"A", updatedBy:"A", version:1, deleted:false };
var v2 = { id:sid2, text:"v2", startDate:"2026-06-21", endDate:"2026-06-25", color:"blue", createdAt:"2026-06-01T00:00:00Z", updatedAt:"2026-06-20T09:00:00Z", createdBy:"A", updatedBy:"A", version:2, deleted:false };
var r7 = mergeTasksMultiDevice([v2],[v1]);
check("v2高版本胜", r7.tasks.length===1 && r7.tasks[0].text==="v2", "期望v2,实际:"+(r7.tasks[0]?r7.tasks[0].text:"无"));

// TEST 8: 删除传播
console.log("\n=== TEST 8: 删除传播 ===");
var sid3 = "del_prop";
var orig = { id:sid3, text:"原始", startDate:"2026-06-21", endDate:"2026-06-25", color:"blue", createdAt:"2026-06-01T00:00:00Z", updatedAt:"2026-06-20T10:00:00Z", createdBy:"A", updatedBy:"A", version:1, deleted:false };
var del = { id:sid3, text:"原始", startDate:"2026-06-21", endDate:"2026-06-25", color:"blue", createdAt:"2026-06-01T00:00:00Z", updatedAt:"2026-06-21T10:00:00Z", createdBy:"A", updatedBy:"A", version:2, deleted:true };
var r8 = mergeTasksMultiDevice([del], [orig]);
check("删除传播", r8.tasks.length===0, "期望0条(已删)");

console.log("\n" + "=".repeat(40));
console.log("结果: " + passed + "/" + (passed+failed) + " 通过");
if (failed === 0) console.log("ALL TESTS PASSED");
else console.log(failed + " TESTS FAILED");
