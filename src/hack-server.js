
const weakenScript = "do-weaken.ns";
const growScript = "do-grow.ns";
const hackScript = "do-hack.ns";

/** @param {NS} ns **/
export async function main(ns) {

	const params = ns.flags([
		// 服务器名
		['name', ''],
	]);

	const { name } = params;

	ns.disableLog("ALL");
	// 验证服务器是否存在
	if (!verifyServer(ns, name)) return;
	// 判断服务器是否可以root	
	const server = ns.getServer(name);
	if (!canHackServer(ns, server)) return;
	rootServer(ns, server);
	// 清空所有脚本
	ns.killall(server.hostname);
	await ns.sleep(1000);
	// 复制脚本到目标服务器
	await copyScriptToHostServer(ns);
	// 开始循环任务
	await hackEventLoop(ns, server);
}

/**
 * 验证服务器是否存在
 * @param {NS} ns
 * @param {string} name
 */
function verifyServer(ns, name) {
	if (!ns.serverExists(name)) {
		ns.print(`服务器${name}不存在`);
		return false;
	}
	return true;
}

/** 
 * 检查当前破解工具个数
 * @param {NS} ns
 **/
function getCurrentPortTools(ns) {
	var tools = 0;
	if (ns.fileExists("BruteSSH.exe", "home")) tools++;
	if (ns.fileExists("FTPCrack.exe", "home")) tools++;
	if (ns.fileExists("relaySMTP.exe", "home")) tools++;
	if (ns.fileExists("HTTPWorm.exe", "home")) tools++;
	if (ns.fileExists("SQLInject.exe", "home")) tools++;
	return tools;
}

/** 
 * 使用破解工具
 * @param {NS} ns 
 * @param {Server} server 
 **/
function rootServer(ns, server) {
	// 已经root
	if (server.hasAdminRights) return;
	if (!server.sshPortOpen && ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(server.hostname);
	if (!server.ftpPortOpen && ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(server.hostname);
	if (!server.smtpPortOpen && ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(server.hostname);
	if (!server.httpPortOpen && ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(server.hostname);
	if (!server.sqlPortOpen && ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(server.hostname);
	ns.nuke(server.hostname);
}

/** 
 * 判断服务器是否可以Hack
 * @param {NS} ns
 * @param {Server} server 
 **/
function canHackServer(ns, server) {

	// 服务器属于自己的
	if (server.purchasedByPlayer) {
		ns.print(`${server.hostname}属于自己的服务器，不能Hack`);
		return false;
	}

	// 检查hack等级
	const hackLvl = ns.getHackingLevel();
	const targetHackLvl = server.requiredHackingSkill;
	if (targetHackLvl > hackLvl) {
		ns.print(`${server.hostname} 需求Hack等级${targetHackLvl} 大于当前 ${hackLvl}`);
		return false;
	}

	// 检查端口需求
	const tools = getCurrentPortTools(ns);
	const targetPorts = server.numOpenPortsRequired;
	if (targetPorts > tools) {
		ns.print(`${server.hostname} 需求Port${targetPorts} 大于工具个数 ${tools}`);
		return false;
	}
	return true;
}

/**
 * 分析目标服务器
 * @param {NS} ns
 * @param {Server} server
 */
function analyzeServer(ns, server) {

	// 单个Thread一次hack
	const hackPercent = ns.hackAnalyze(server.hostname);
	ns.print(`HackPercent: ${hackPercent * 100} %`);

	// hack成功率
	const hackChance = ns.hackAnalyzeChance(server.hostname);
	ns.print(`HackChance: ${hackChance * 100} %`);

	// hack导致的安全值上升
	const hackSecurityGrow = ns.hackAnalyzeSecurity(1);
	ns.print(`HackSecurityGrow: ${hackSecurityGrow}`);

	// 当前Hack时间
	const hackTime = ns.getHackTime(server.hostname);
	ns.print(`HackTime: ${hackTime / 1000} s`);

	// 单个Thread一次Weaken
	const weakenValue = ns.weakenAnalyze(1);
	ns.print(`WeakenValue: ${weakenValue}`);

	// Weaken时间
	const weakenTime = ns.getWeakenTime(server.hostname);
	ns.print(`WeakenTime: ${weakenTime / 1000} s`);

	// 单个Thread一次grow
	const growPercent = ns.getServerGrowth(server.hostname);
	ns.print(`GrowPercent: ${growPercent / 100} %`);

	// grow导致的安全值上升
	const growSecurityGrow = ns.growthAnalyzeSecurity(1);
	ns.print(`GrowSecurityGrow: ${growSecurityGrow}`);

	// grow时间
	const growTime = ns.getGrowTime(server.hostname);
	ns.print(`GrowTime: ${growTime / 1000} s`);

	return {
		hackPercent,
		hackChance,
		hackSecurityGrow,
		hackTime,
		weakenValue,
		weakenTime,
		growPercent,
		growSecurityGrow,
		growTime
	};
}

/**
 * 复制脚本到部署服务器
 * @param {NS} ns
 */
async function copyScriptToHostServer(ns) {

	const hostName = ns.getHostname();
	if (hostName === 'home') return;
	await ns.scp(
		[weakenScript, growScript, hackScript],
		"home",
		hostName
	);
}

/**
 * Hack事件循环
 * @param {NS} ns
 * @param {Server} server
 */
async function hackEventLoop(ns, server) {

	// 部署服务器
	const hostServer = ns.getServer();

	// 目标服务器当前情况
	const moneyMax = ns.getServerMaxMoney(server.hostname);
	const moneyThreshold = moneyMax * 0.8;
	const securityMin = server.minDifficulty;
	const securityThreshold = (server.baseDifficulty - securityMin) * 0.2 + securityMin;

	// 脚本内存占用
	const hackRam = ns.getScriptRam(hackScript);
	const weakenRam = ns.getScriptRam(weakenScript);
	const growRam = ns.getScriptRam(growScript);
	// 这三个脚本内存占用差不多，简单点，就直接计算平均数
	const scriptAvgRam = (hackRam + weakenRam + growRam) / 3;

	// 循环计数
	var count = 0;

	while (true) {

		count++;
		const analyze = analyzeServer(ns, server);
		var money = ns.getServerMoneyAvailable(server.hostname);
		const security = ns.getServerSecurityLevel(server.hostname);

		// 计算本次需要进行的任务
		const needWeaken = security > securityThreshold;
		const needGrow = money < moneyThreshold;

		// 计算Weaken所需线程
		var weakenThread = 0;
		if (needWeaken) {
			weakenThread = Math.floor((security - securityThreshold) / analyze.weakenValue);
		}

		// 计算Grow所需线程
		var growThread = 0;
		var moneyTarget = money;
		if (needGrow) {
			if (money <= 0) money = 1;
			ns.print(`【${count}】目标金额增长比例(${moneyThreshold / money})`);
			growThread = Math.floor(ns.growthAnalyze(server.hostname, moneyThreshold / money));
			moneyTarget = moneyThreshold;
		}
		ns.print(`【${count}】Hack金额目标(${formatMoney(moneyTarget)})`);

		// 计算Hack所需线程
		var hackThread = Math.ceil(1 / analyze.hackPercent);
		// 防止计算出无限值
		if (hackThread === Infinity) {
			hackThread = 1000;
		}

		ns.print(`【${count}】初步计算\nWeaken(t=${weakenThread}), 安全(${security}), 阈值(${securityThreshold})\nGrow(t=${growThread}), 当前(${formatMoney(money)}), 阈值(${(formatMoney(moneyThreshold))}),\nHack(t=${hackThread})`);
		// 判断Ram占用是否超出上限
		let freeRam = hostServer.maxRam - ns.getServerUsedRam(hostServer.hostname);
		var totalNeedRam = 0;
		do {

			let weakenNeedRam = weakenThread * weakenRam;
			let growNeedRam = growThread * growRam;
			let hackNeedRam = hackThread * hackRam;
			totalNeedRam = weakenNeedRam + growNeedRam + hackNeedRam;

			// 削减线程数
			if (totalNeedRam > freeRam) {
				ns.print(`【${count}】内存超额，需要${totalNeedRam}GB，剩余(${freeRam})GB，开始削减`);
				// 计算削减数
				var delta = Math.ceil((totalNeedRam - freeRam) / scriptAvgRam);
				// 优先削减　hack > grow > weakem
				let hackDelta = Math.min(hackThread, delta);
				delta -= hackDelta;
				if (delta < 0) delta = 0;

				let growDelta = Math.min(growThread, delta);
				delta -= growDelta;
				if (delta < 0) delta = 0;

				let weakenDelta = delta;
				ns.print(`【${count}】线程削减总数${delta}, weaken削减${weakenDelta}, grow削减${growDelta}, hack削减${hackDelta}`);

				weakenThread -= weakenDelta;
				growThread -= growDelta;
				hackThread -= hackDelta;
			}

			if (weakenThread < 0) weakenThread = 0;
			if (growThread < 0) growThread = 0;
			if (hackThread < 0) hackThread = 0;
		}
		while (totalNeedRam > freeRam);

		ns.print(`【${count}】最终计算, Weaken(t=${weakenThread}), Grow(t=${growThread}), Hack(t=${hackThread})`);

		var weakenTime = weakenThread > 0 ? analyze.weakenTime : 0;
		var growTime = growThread > 0 ? analyze.growTime : 0;
		var hackTime = hackThread > 0 ? analyze.hackTime : 0;
		ns.print(`【${count}】Weaken用时(${(weakenTime / 1000).toFixed(3)} s), Grow用时(${(growTime / 1000).toFixed(3)} s), Hack用时(${(hackTime / 1000).toFixed(3)} s)`);


		// 永远先执行grow
		if (growThread > 0) {
			ns.print(`【${count}】执行Grow`);
			ns.exec(growScript, hostServer.hostname, growThread, server.hostname, 0);
		}
		// 如果需要Hack，则Grow之后再执行Hack
		if (hackThread > 0) {
			var delayTime = 0;
			if (growTime > hackTime) {
				delayTime = growTime - hackTime + 400;
			}
			ns.print(`【${count}】执行Hack，延迟${(delayTime / 1000).toFixed(3)} s`);
			ns.exec(hackScript, hostServer.hostname, hackThread, server.hostname, delayTime);
			hackTime += delayTime;
		}
		// 如果需要weaken
		if (weakenThread > 0) {
			var delayTime = 0;
			let beforeTime = Math.max(growTime, hackTime);
			if (weakenTime < beforeTime) {
				delayTime = beforeTime - weakenTime + 400;
			}
			ns.print(`【${count}】执行Weaken，延迟${(delayTime / 1000).toFixed(3)} s`);
			ns.exec(weakenScript, hostServer.hostname, weakenThread, server.hostname, delayTime);
			weakenTime += delayTime;
		}

		let totalTime = Math.max(weakenTime, growTime, hackTime) + 1000;
		ns.print(`【${count}】开始执行脚本，预计需要${(totalTime / 1000).toFixed(3)} s`);
		await ns.sleep(totalTime);
	}
}

// 金额格式化
function formatMoney(money) {

	if (money >= 1000000000000) {
		return `${(money / 1000000000000).toFixed(2)} t`;
	}
	else if (money >= 1000000000) {
		return `${(money / 1000000000).toFixed(2)} b`;
	}
	else if (money >= 1000000) {
		return `${(money / 1000000).toFixed(2)} m`;
	}
	else if (money >= 1000) {
		return `${(money / 1000).toFixed(2)} k`;
	}
	else {
		return `${money}`;
	}
}