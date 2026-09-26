(function () {
	'use strict';

	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
	function rgb(c) { return 'rgb(' + c.join(',') + ')'; }
	function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	/* ---------- Scene: sky, stars, sun, ridgelines ---------- */

	// Sky keyframes: night, pre-dawn, alpenglow, morning, day
	var SKY = [
		{ p: 0.00, top: [8, 12, 40], mid: [20, 24, 66], bot: [42, 38, 92] },
		{ p: 0.28, top: [22, 26, 70], mid: [70, 52, 110], bot: [168, 92, 130] },
		{ p: 0.50, top: [58, 78, 138], mid: [226, 132, 150], bot: [255, 186, 140] },
		{ p: 0.75, top: [86, 150, 214], mid: [170, 206, 232], bot: [250, 222, 190] },
		{ p: 1.00, top: [58, 138, 214], mid: [140, 196, 236], bot: [214, 236, 248] }
	];
	// Ridge layers, far to near
	var LAYERS = [
		{ night: [38, 36, 84], day: [150, 178, 208], glow: [255, 170, 170], depth: 0.10, h: 0.60, haze: 0.55, rough: 0.55, seed: 3 },
		{ night: [30, 30, 70], day: [112, 146, 184], glow: [246, 150, 150], depth: 0.22, h: 0.52, haze: 0.40, rough: 0.6, seed: 11 },
		{ night: [22, 24, 56], day: [78, 112, 150], glow: [220, 120, 130], depth: 0.38, h: 0.44, haze: 0.26, rough: 0.7, seed: 19 },
		{ night: [16, 18, 44], day: [52, 82, 110], glow: [170, 90, 110], depth: 0.56, h: 0.36, haze: 0.14, rough: 0.8, seed: 27 },
		{ night: [10, 12, 30], day: [30, 52, 70], glow: [110, 60, 80], depth: 0.78, h: 0.28, haze: 0.04, rough: 0.9, seed: 41 }
	];

	function skyAt(p) {
		for (var i = 0; i < SKY.length - 1; i++) {
			if (p <= SKY[i + 1].p) {
				var t = (p - SKY[i].p) / (SKY[i + 1].p - SKY[i].p);
				return { top: mix(SKY[i].top, SKY[i + 1].top, t), mid: mix(SKY[i].mid, SKY[i + 1].mid, t), bot: mix(SKY[i].bot, SKY[i + 1].bot, t) };
			}
		}
		return SKY[SKY.length - 1];
	}

	var ridgeHost = document.getElementById('ridges');
	var ridges = LAYERS.map(function (L, idx) {
		// Midpoint displacement gives a jagged alpine skyline instead of plateaus.
		var r = rand(L.seed * 7919), N = 128, ys = new Array(N + 1);
		ys[0] = 0.35 + r() * 0.3; ys[N] = 0.35 + r() * 0.3;
		for (var step = N, amp = 1.2 * L.rough; step > 1; step /= 2, amp *= 0.54) {
			for (var k = step / 2; k < N; k += step) ys[k] = (ys[k - step / 2] + ys[k + step / 2]) / 2 + (r() - 0.5) * amp;
		}
		var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
		var d = 'M0 400 ' + ys.map(function (y, k) {
			return 'L' + (k / N * 1000).toFixed(1) + ' ' + ((0.06 + (y - lo) / (hi - lo) * 0.72) * 400).toFixed(1);
		}).join(' ') + ' L1000 400 Z';
		var wrap = el('div', 'ridge');
		wrap.style.height = (L.h * 100) + 'vh';
		wrap.style.zIndex = idx;
		wrap.innerHTML = '<svg viewBox="0 0 1000 400" preserveAspectRatio="none">' +
			'<defs><linearGradient id="g' + idx + '" x1="0" y1="0" x2="0" y2="1">' +
			'<stop offset="0"/><stop offset="0.35"/><stop offset="1"/></linearGradient></defs>' +
			'<path d="' + d + '" fill="url(#g' + idx + ')"/></svg>';
		ridgeHost.appendChild(wrap);
		return { el: wrap, stops: wrap.querySelectorAll('stop'), L: L };
	});

	var stars = document.getElementById('stars'), rs = rand(1234);
	for (var s = 0; s < 120; s++) {
		var star = document.createElement('i');
		star.style.left = (rs() * 100) + '%';
		star.style.top = (rs() * 100) + '%';
		star.style.setProperty('--o', (0.3 + rs() * 0.7).toFixed(2));
		if (rs() > 0.85) star.style.width = star.style.height = '3px';
		stars.appendChild(star);
	}

	var sky = document.getElementById('sky'), sun = document.getElementById('sun');

	function paint(p) {
		var c = skyAt(p);
		sky.style.background = 'linear-gradient(to bottom,' + rgb(c.top) + ' 0%,' + rgb(c.mid) + ' 55%,' + rgb(c.bot) + ' 100%)';
		stars.style.opacity = Math.max(0, 1 - p * 2.6);
		var sp = Math.max(0, Math.min(1, (p - 0.3) / 0.6));
		sun.style.top = (72 - sp * 58) + '%';
		sun.style.opacity = Math.min(1, sp * 3);
		var glow = Math.max(0, 1 - Math.abs(p - 0.5) / 0.25);
		var dayT = Math.max(0, Math.min(1, (p - 0.15) / 0.75));
		ridges.forEach(function (R) {
			var base = mix(mix(R.L.night, R.L.day, dayT), c.bot, R.L.haze);
			var crest = mix(mix(base, R.L.glow, glow * 0.8), [246, 248, 252], dayT * 0.35 * (1 - R.L.haze * 0.5));
			R.stops[0].setAttribute('stop-color', rgb(crest));
			R.stops[1].setAttribute('stop-color', rgb(base));
			R.stops[2].setAttribute('stop-color', rgb(mix(base, [0, 0, 0], 0.18)));
			// Descending: the ranges start far below the summit and rise around you
			if (!reduce) R.el.style.transform = 'translate3d(-50%,' + ((1 - p) * R.L.depth * 100).toFixed(2) + 'vh,0)';
		});
	}

	/* ---------- Altitude: interpolated between camp centers ---------- */

	var MIN = 1200, MAX = 4000;
	var LANDING = 76; // where a camp box lands: just under the top bar
	var autoScrolling = false, autoTimer;
	var mark = document.getElementById('mark');
	var heroName = document.querySelector('.hero h1');
	var legs = Array.prototype.slice.call(document.querySelectorAll('[data-alt]'));
	var trailhead = document.getElementById('trailhead');
	var rail = document.getElementById('alt');
	var num = document.getElementById('alt-num'), needle = document.getElementById('alt-needle');
	var railLinks = Array.prototype.slice.call(document.querySelectorAll('.alt-camps a'));

	// A camp is reached when its top crosses a line just under the top bar,
	// so jumping to a camp reads exactly that camp's altitude.
	function boxOf(leg) { return leg.querySelector('.panel') || leg; }
	function altitude() {
		var line = LANDING + 4;
		for (var i = legs.length - 1; i >= 0; i--) {
			var top = boxOf(legs[i]).getBoundingClientRect().top;
			if (top <= line) {
				if (i === legs.length - 1) return +legs[i].dataset.alt;
				var nextTop = boxOf(legs[i + 1]).getBoundingClientRect().top;
				var t = Math.min(1, (line - top) / (nextTop - top));
				return +legs[i].dataset.alt + (+legs[i + 1].dataset.alt - +legs[i].dataset.alt) * t;
			}
		}
		return MIN;
	}

	function update() {
		var alt = altitude(), p = (MAX - alt) / (MAX - MIN); // 0 at the summit, 1 at the trailhead
		if (!reduce) paint(p);
		num.textContent = (Math.round(alt / 10) * 10).toLocaleString('en-US');
		needle.style.top = (p * 100) + '%';
		// Back at the trailhead the rail has done its job
		rail.classList.toggle('is-away', trailhead.getBoundingClientRect().top < window.innerHeight * 0.3);
		// The home pill appears once the big name has scrolled out of view
		var shown = heroName.getBoundingClientRect().bottom < 40;
		mark.classList.toggle('is-shown', shown);
		mark.tabIndex = shown ? 0 : -1;
	}

	var campObserver = new IntersectionObserver(function (entries) {
		entries.forEach(function (e) {
			if (!e.isIntersecting) return;
			railLinks.forEach(function (a) {
				if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
				else a.removeAttribute('aria-current');
			});
			if (reduce) paint((MAX - e.target.dataset.alt) / (MAX - MIN));
		});
	}, { rootMargin: '-45% 0px -50% 0px' });
	legs.forEach(function (l) { campObserver.observe(l); });

	var ticking = false;
	window.addEventListener('scroll', function () {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(function () { ticking = false; update(); });
	}, { passive: true });
	window.addEventListener('resize', update);
	paint((MAX - altitude()) / (MAX - MIN));
	update();

	/* ---------- Agent console ---------- */

	var SCENARIOS = {
		research: [
			{ user: 'How much XRP does the treasury wallet hold on testnet, and what did it do this week?' },
			{ tool: 'xrpl_account_info', args: '{ "account": "rTreasury…9kQ2", "network": "testnet" }',
				result: '{ "balance": "12480.25 XRP", "sequence": 4211 }' },
			{ tool: 'xrpl_account_tx', args: '{ "account": "rTreasury…9kQ2", "since": "7d" }',
				result: '[ Payment  -450 XRP,\n  Payment  -1200 XRP,\n  TrustSet USD stablecoin ]' },
			{ agent: 'The treasury wallet holds 12,480.25 test XRP. This week it sent two payments, 450 and 1,200 XRP, and set one new trust line for a USD stablecoin.' }
		],
		execute: [
			{ user: 'Pay the vendor 250 XRP from the operating wallet.' },
			{ tool: 'xrpl_prepare_payment', args: '{ "from": "rOperating…3fT8", "to": "rVendor…7mW1", "amount": "250 XRP" }',
				result: '{ "tx": "Payment", "fee": "0.000012 XRP", "signed": false }' },
			{ agent: 'Here is the payment, unsigned. It needs your approval before I sign and submit it.' },
			{ approve: true }
		]
	};
	var AFTER_APPROVE = [
		{ tool: 'xrpl_submit', args: '{ "tx": "Payment", "approved_by": "you" }',
			result: '{ "result": "tesSUCCESS", "ledger_index": 8841207 }', ok: true },
		{ agent: 'Done. The payment settled in ledger 8,841,207.' }
	];
	var AFTER_CANCEL = [{ agent: 'Cancelled. Nothing was signed or sent.' }];

	var log = document.getElementById('console-log');
	var tabs = Array.prototype.slice.call(document.querySelectorAll('.console-tabs button'));
	var runId = 0, current = 'research', started = false;
	var replayBtn = document.getElementById('console-replay');

	function render(step, id) {
		if (step.user) log.appendChild(el('div', 'msg msg-user', step.user));
		else if (step.agent) log.appendChild(el('div', 'msg msg-agent', step.agent));
		else if (step.tool) {
			var box = el('div', 'tool'), head = el('div', 'tool-head'), name = el('span');
			name.appendChild(el('b', null, step.tool));
			name.appendChild(document.createTextNode(' via MCP'));
			head.appendChild(name);
			head.appendChild(el('span', step.ok ? 'ok' : '', step.ok ? 'settled' : 'ok'));
			box.appendChild(head);
			box.appendChild(el('pre', null, step.args + '\n→ ' + step.result));
			log.appendChild(box);
		} else if (step.approve) {
			var actions = el('div', 'console-actions');
			var yes = el('button', 'approve', 'Approve and send'), no = el('button', 'cancel', 'Cancel');
			yes.type = no.type = 'button';
			yes.addEventListener('click', function () { actions.remove(); replayBtn.focus(); play(AFTER_APPROVE, id); });
			no.addEventListener('click', function () { actions.remove(); replayBtn.focus(); play(AFTER_CANCEL, id); });
			actions.appendChild(yes); actions.appendChild(no);
			log.appendChild(actions);
		}
	}

	function play(steps, id) {
		var i = 0;
		(function next() {
			if (id !== runId || i >= steps.length) return;
			var step = steps[i++];
			if (reduce) { render(step, id); log.scrollTop = log.scrollHeight; next(); return; }
			var dots = null;
			if (!step.user && !step.approve) {
				dots = el('div', 'msg msg-agent typing');
				dots.setAttribute('aria-hidden', 'true');
				dots.innerHTML = '<i></i><i></i><i></i>';
				log.appendChild(dots);
				log.scrollTop = log.scrollHeight;
			}
			setTimeout(function () {
				if (dots) dots.remove();
				if (id !== runId) return;
				render(step, id);
				log.scrollTop = log.scrollHeight;
				next();
			}, step.user ? 350 : step.tool ? 700 : 900);
		})();
	}

	function run(name) {
		started = true;
		current = name;
		runId++;
		log.innerHTML = '';
		tabs.forEach(function (t) {
			var on = t.dataset.scenario === name;
			t.setAttribute('aria-selected', on ? 'true' : 'false');
			t.tabIndex = on ? 0 : -1;
			if (on) log.setAttribute('aria-labelledby', t.id);
		});
		play(SCENARIOS[name], runId);
	}

	tabs.forEach(function (t, idx) {
		t.addEventListener('click', function () { run(t.dataset.scenario); });
		t.addEventListener('keydown', function (e) {
			if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
			var n = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
			n.focus(); run(n.dataset.scenario);
		});
	});
	replayBtn.addEventListener('click', function () { run(current); });
	new IntersectionObserver(function (entries, obs) {
		if (!entries[0].isIntersecting) return;
		obs.disconnect();
		if (!started) run('research');
	}, { threshold: 0.35 }).observe(log);

	/* ---------- The guide: written answers, matched by keyword ---------- */

	// Written answers, most specific first: ties go to the earlier entry.
	var QA = [
		{"id": "greeting", "q": "Hello", "keys": ["hello", "hey", "hi", "hiya", "howdy", "greetings", "good morning", "good afternoon", "good evening", "yo", "sup", "hola", "whats up", "anyone there", "anybody there", "what s up"], "a": "Welcome, traveler. I'm the guide on this trail, and every answer here was written in advance. Ask about Dimitri's work at Ripple or AWS, the AI and blockchain projects, the talks, or the mountains.", "go": [["Start the descent", "#summit"]]},
		{"id": "guide-ai", "q": "Are you an AI?", "keys": ["are you an ai", "an ai", "are you ai", "u ai", "chatgpt", "chat gpt", "gpt", "openai", "llm powered", "bot", "robot", "chatbot", "who are you", "who is this", "real person", "scripted", "how does this work", "how do you work", "powered by", "language model", "are you claude", "is this claude", "is this ai", "guide", "sentient", "talking to a", "a bot", "this claude", "you claude", "this chat", "chat work", "are you human", "you human", "real human", "talking to a human", "typing", "someone typing", "is someone", "live person"], "a": "No AI model runs here. The guide is scripted: every answer was written in advance and matched to your question by keywords, and most answers link to the part of the page that covers them.", "go": [["See Dimitri's AI work", "#summit"]]},
		{"id": "agent-demo", "q": "Is the agent demo real?", "keys": ["illustration", "sketch", "testnet", "test net", "treasury", "treasury wallet", "wallet", "trust line", "real ledger", "fake", "made-up", "made up", "mock", "simulated", "is it real", "is that real", "is this real", "animation", "chat window", "agent demo", "demo real", "is the demo real", "mainnet", "main net", "payment demo", "is it live", "live on"], "a": "The agent session at the summit is an illustration with made-up testnet data, not Dimitri's actual tools. Nothing in it touches a real ledger, and a person approves the payment before anything is signed.", "go": [["Show me the sketch", "#agents"]]},
		{"id": "agentic", "q": "What's agentic finance?", "chip": 4, "keys": ["agentic", "agent", "agents", "mcp", "model context protocol", "mcp server", "on-chain", "onchain", "on chain", "execute transaction", "transactions", "agentic finance", "agentic payments", "ai agents", "autonomous", "mcp ", "model context protocol"], "a": "AI agents that can read a ledger and act on it. Dimitri builds internal MCP servers that let an agent research XRPL data and execute on-chain transactions. There's a short illustration at the summit, with made-up testnet data.", "go": [["Show me the sketch", "#agents"], ["Show me the summit", "#summit"]]},
		{"id": "feedback", "q": "Did Dimitri give feedback to AWS service teams?", "keys": ["feedback", "service team", "service teams", "product team", "product feedback", "features", "feature request", "roadmap", "influence", "influence claude", "feedback on claude"], "a": "At AWS, Dimitri fed customer and partner feedback to AWS service teams on 10+ features, Claude on Amazon Bedrock among them.", "go": [["Show me AWS", "#camp2"]]},
		{"id": "claude", "q": "How does Dimitri use Claude?", "chip": 3, "keys": ["claude", "cluade", "anthropic", "anthropics", "antropic", "anthopic", "claude code", "claude api", "bedrock", "opus", "sonnet", "haiku", "claud "], "a": "Dimitri designed an AI RFP workflow with Claude on Amazon Bedrock and built the Ripple team's enablement stack with Claude Code, and this site was built with Claude Code too. At AWS, Dimitri fed customer and partner feedback to AWS service teams on 10+ features, Claude on Amazon Bedrock among them.", "go": [["Show me Ripple", "#camp3"], ["Show me AWS", "#camp2"]]},
		{"id": "rfp", "q": "What is the AI RFP workflow?", "keys": ["rfp", "rfps", "request for proposal", "proposal", "proposals", "step functions", "step function", "stepfunctions", "workflow", "orchestrat", "questionnaire"], "a": "Dimitri designed an AI RFP workflow at Ripple with Claude on Amazon Bedrock and AWS Step Functions, used on 10+ RFPs. An eval harness scores every run against a principle-based rubric with golden answers built in, and a human review-and-fix loop follows.", "go": [["Show me Ripple", "#camp3"]]},
		{"id": "evals", "q": "Does Dimitri have eval experience?", "keys": ["eval", "evals", "evaluat", "evalu", "harness", "rubric", "golden answer", "golden set", "benchmark", "scoring", "scored", "score", "grading", "grade", "llm-as-judge", "judge", "quality", "accuracy", "human review", "human in the loop", "hallucinat", "testing ai", "checked", "answers checked"], "a": "At Ripple, an eval harness scores every run of Dimitri's RFP workflow against a principle-based rubric with golden answers built in, followed by a human review-and-fix loop. At AWS, Dimitri co-designed how the models in InterSystems' IntelliCare were scored by clinical task.", "go": [["Show me Ripple", "#camp3"], ["Show me AWS", "#camp2"]]},
		{"id": "enablement", "q": "What is Solutions Exchange?", "keys": ["solutions exchange", "solution exchange", "exchange", "portal", "okta", "tutorial", "tutorials", "enablement", "enable", "meeting prep", "prep time", "internal tools", "tooling for the team", "sales tools"], "a": "Solutions Exchange is an Okta-integrated portal for sharing and deploying demos, part of the enablement stack Dimitri built for the Ripple team with Claude Code. Alongside it are interactive Ripple Custody and Ripple Payments tutorials that cut meeting prep from days to hours.", "go": [["Show me Ripple", "#camp3"]]},
		{"id": "ai-lead", "q": "What does Dimitri do as an org AI lead?", "keys": ["ai lead", "org ai", "ai training", "reps", "sales team", "sales org", "adoption", "upskill", "champion", "internal ai", "sales training", "trains", "training for", "train "], "a": "Dimitri serves as an org AI lead for sales at Ripple, running AI training for 20+ reps and building internal AI tooling.", "go": [["Show me Ripple", "#camp3"]]},
		{"id": "xrpl", "q": "What has Dimitri built on XRPL?", "keys": ["xrpl", "xrp ledger", "xrp", "xrpledger", "ledger", "node", "nodes", "validator", "multi-network"], "a": "At AWS, Dimitri built private XRPL node infrastructure and agentic AI POCs that query multi-network ledger data. At Ripple, Dimitri built a stablecoin and tokenized-deposit engine on Ethereum and XRPL, plus internal MCP servers for XRPL data research and on-chain transaction execution.", "go": [["Show me Ripple", "#camp3"], ["Show me AWS", "#camp2"]]},
		{"id": "demos", "q": "What demos has Dimitri built?", "keys": ["demo", "demos", "prototype", "poc", "pocs", "proof of concept", "projects", "portfolio", "ios", "iphone", "app", "global bank", "onsite", "showcase", "has he built", "have you built", "has dimitri built", "things built", "what did dimitri build", "custody app", "ios app", "demo engine", "deposit engine"], "a": "At Ripple, Dimitri built a stablecoin and tokenized-deposit engine on Ethereum and XRPL with an iOS custody front end, and used it as the closing demo in an onsite session for a global bank's engineering leadership. At AWS, Dimitri delivered 100+ customer demos and reference implementations.", "go": [["Show me Ripple", "#camp3"], ["Show me AWS", "#camp2"]]},
		{"id": "blockchain", "q": "What blockchain work does Dimitri do?", "keys": ["blockchain", "block chain", "blockchian", "bank", "g-sib", "gsib", "custody", "custodian", "key management", "stablecoin", "stable coin", "tokeniz", "tokenis", "tokenized deposit", "crypto", "digital asset", "digital-asset", "payments", "ethereum", "defi", "web3", "dlt", "distributed ledger", "network choice"], "a": "Dimitri advises 20+ banks, from G-SIBs to regionals, on digital-asset strategy, custody, and key management, then builds the demos that make it concrete: stablecoins, tokenized deposits, and custody on Ethereum and the XRP Ledger.", "go": [["Show me the summit", "#summit"], ["Show me Ripple", "#camp3"]]},
		{"id": "partners", "q": "What partner work has Dimitri done?", "keys": ["partner", "partners", "partnership", "alliances", "alliance", "caylent", "si partner", "system integrator", "systems integrator", "isv", "isvs", "channel", "co-sell", "ecosystem", "blockchain isv", "sis", "worked with si", "with sis"], "a": "At AWS, Dimitri drove several migrations with SI partner Caylent, helped secure a multi-year partnership with a blockchain ISV, and designed the AWS architecture for the multi-provider AI layer in ISV partner InterSystems' IntelliCare. Partner enablement is on the skills list too.", "go": [["Show me AWS", "#camp2"], ["Show me the skills", "#skills"]]},
		{"id": "healthcare", "q": "What healthcare AI has Dimitri worked on?", "keys": ["healthcare", "health care", "health", "medical", "clinical", "clinician", "hospital", "ehr", "intellicare", "intelli care", "intersystems", "inter systems", "mdr", "class iia", "patient", "doctor", "physician", "life sciences", "multi-provider", "multi provider", "medical ai"], "a": "At AWS, Dimitri designed the AWS architecture for the multi-provider AI layer in InterSystems' IntelliCare, the first AI-native EHR to earn EU MDR Class IIa certification, and co-designed how its models were scored by clinical task. Dimitri also architected and scoped LLM fine-tuning on de-identified data for a mental health platform.", "go": [["Show me AWS", "#camp2"]]},
		{"id": "fine-tuning", "q": "Has Dimitri worked on fine-tuning?", "keys": ["fine-tun", "fine tun", "finetun", "fine-tuning", "training data", "de-identified", "deidentified", "mental health", "therapy", "therapist", "companion", "custom model", "train a model", "trained a model", "model training", "mental", "training a model", "train a", "train an", "trained an"], "a": "At AWS, Dimitri architected and scoped LLM fine-tuning on de-identified data for a mental health platform, ahead of the launch of its AI mental health companion.", "go": [["Show me AWS", "#camp2"]]},
		{"id": "hackathon", "q": "Has Dimitri won a hackathon?", "keys": ["hackathon", "hackathons", "hack-a-thon", "hackaton", "ai heroes", "heroes", "won", "win", "winner", "first place", "award", "awards", "prize", "competition", "inbox", "innovation club"], "a": "Dimitri placed first in AWS's Industries AI Heroes hackathon, representing Healthcare and Life Sciences, with a physician-inbox organizer and a doctor-facing chatbot. At Travelers, Dimitri organized an innovation club, developer workshops, and hackathons reaching 1,000+ participants.", "go": [["Show me AWS", "#camp2"], ["Show me Travelers", "#base"]]},
		{"id": "workshops", "q": "Does Dimitri teach or run workshops?", "keys": ["workshop", "workshops", "teach", "teaching", "developer advocacy", "devrel", "dev rel", "developer relations", "advocate", "reference implementation", "mentoring", "instruct", "classes"], "a": "Dimitri delivered 40+ developer workshops, 100+ customer demos, and reference implementations at AWS, and at Ripple runs AI training for 20+ reps. Teaching developers goes back to the Travelers days, with workshops and hackathons reaching 1,000+ participants.", "go": [["Show me AWS", "#camp2"], ["Show me the talks", "#talks"]]},
		{"id": "migrations", "q": "What migrations has Dimitri worked on?", "keys": ["migration", "migrat", "modernization", "moderniz", "legacy", "lift and shift", "move to the cloud", "cloud migration", "event-driven", "event driven"], "a": "At AWS, Dimitri advised ~20 enterprise accounts in financial services and healthcare and drove 30+ migrations, several with SI partner Caylent. Earlier, at Travelers, Dimitri led a team migrating legacy financial systems to API and event-driven architectures.", "go": [["Show me AWS", "#camp2"], ["Show me Travelers", "#base"]]},
		{"id": "ripple", "q": "What does Dimitri do at Ripple?", "keys": ["ripple", "ripples", "rippel", "customer solutions", "north america", "pre-sales", "presales", "pre sales", "sales engineer", "do sales", "in sales", "sales role"], "a": "Since Aug 2025, Dimitri has been a Customer Solutions Director at Ripple, leading the North America Customer Solutions team as a player-coach and advising 20+ banks on digital-asset strategy, custody, and key management. Dimitri also builds much of what the team demos and teaches with.", "go": [["Show me Ripple", "#camp3"]]},
		{"id": "aws", "q": "What did Dimitri do at AWS?", "keys": ["aws", "amazon", "amazon web services", "solutions architect", "solution architect", "senior sa", "sa", "enterprise accounts", "financial services", "cloud", "at aws", "at amazon", "aws experience"], "a": "Five years at AWS, Sep 2020 to Aug 2025, most recently as a Senior Solutions Architect in New York. Dimitri advised ~20 enterprise accounts in financial services and healthcare, drove 30+ migrations, and was pulled into generative AI early by enterprise accounts and ISV partners.", "go": [["Show me AWS", "#camp2"]]},
		{"id": "travelers", "q": "What did Dimitri do at Travelers?", "keys": ["travelers", "travellers", "traveler", "insurance", "hartford", "connecticut", "accenture", "tech lead", "first job", "early career", "before aws"], "a": "Travelers, Feb 2016 to Aug 2020, as a Tech Lead and Developer in Hartford, CT. Dimitri led seven developers plus an Accenture delivery team migrating legacy financial systems to API and event-driven architectures, including a partner-integration platform handling ~70% of transaction volume.", "go": [["Show me Travelers", "#base"]]},
		{"id": "education", "q": "Where did Dimitri study?", "keys": ["study", "studied", "school", "college", "university", "universities", "mba", "degree", "degrees", "education", "educated", "graduate", "grad", "quinnipiac", "quinnipac", "quinipiac", "bachelor", "major", "entrepreneurship", "abroad", "masters", "master s"], "a": "Quinnipiac University, 2015: an MBA and a BS in Entrepreneurship and Small Business Management, through a competitively selected 4+1 BS+MBA program, with international coursework in France, Hungary, Italy, and Switzerland.", "go": [["Show me education", "#base"]]},
		{"id": "talks", "q": "Has Dimitri given talks?", "chip": 6, "chipText": "Any talks or writing?", "keys": ["talk", "talks", "speak", "speaker", "speaking", "spoke", "conference", "conferences", "keynote", "presentation", "podcast", "podcasts", "youtube", "you tube", "video", "videos", "watch", "apex", "reinvent", "re invent", "builders fair", "global summit", "block stars", "blockstars", "panel", "david schwartz", "schwartz", "events", "xrpl apex"], "a": "Dimitri spoke at XRPL Apex in 2023, 2024, and 2025, all on YouTube, and at the InterSystems Global Summit from 2022 to 2025, and gave live demos at the AWS re:Invent Builders Fair in 2021 and 2022. There's also the Block Stars podcast with David Schwartz, Ripple's CTO Emeritus. On the writing side, there are three AWS blog posts from 2024, including one on orchestrating generative AI workflows with Amazon Bedrock and AWS Step Functions.", "go": [["Show me the talks", "#talks"]]},
		{"id": "writing", "q": "Has Dimitri published anything?", "keys": ["publish", "publication", "blog", "blogs", "article", "articles", "writing", "written", "write", "wrote", "author", "authored", "post", "posts", "paper", "papers", "content", "reading", "something to read"], "a": "Three posts on AWS blogs in 2024: orchestrating generative AI workflows with Amazon Bedrock and AWS Step Functions (Machine Learning Blog), InterSystems IRIS Cloud SQL and IntegratedML (Partner Network Blog), and application-consistent Amazon EBS Snapshots for InterSystems IRIS (Storage Blog).", "go": [["Show me the writing", "#talks"]]},
		{"id": "certs", "q": "What certifications does Dimitri hold?", "keys": ["certif", "certs", "cert", "certificate", "credential", "credentials", "professional", "scrum", "safe", "agile", "sa pro", "exam"], "a": "AWS Solutions Architect - Professional, and SAFe 4.0 Certified Scrum Master.", "go": [["Show me the skills", "#skills"]]},
		{"id": "languages", "q": "What languages and stack does Dimitri use?", "keys": ["stack", "tech stack", "programming", "program", "coding", "code", "coder", "language", "languages", "python", "javascript", "typescript", "java", "react", "nodejs", "csharp", "api", "apis", "webhook", "websocket", "sdk", "sdks", "hands-on", "hands on", "technical", "engineer", "c", "c sharp", "rest api", "node js"], "a": "Dimitri works in JavaScript and TypeScript (React, Node.js), Python, and C#, with REST APIs, webhooks, WebSockets, and SDKs, and architects on AWS with Step Functions, serverless, and event-driven designs.", "go": [["Show me the skills", "#skills"]]},
		{"id": "leadership", "q": "Has Dimitri led teams?", "keys": ["lead", "leader", "leadership", "team", "teams", "manage", "player-coach", "player coach", "people", "direct reports", "reports to", "mentor", "coach", "supervis", "headcount"], "a": "At Ripple, Dimitri leads the Customer Solutions team of pre-sales Solutions Architects as a player-coach while carrying accounts. At Travelers, Dimitri led seven developers plus an Accenture delivery team, and at AWS mentored Solutions Architects and Technical Account Managers.", "go": [["Show me Ripple", "#camp3"], ["Show me Travelers", "#base"]]},
		{"id": "contact", "q": "How do I reach Dimitri?", "chip": 8, "keys": ["contact", "reach", "email", "e-mail", "mail", "linkedin", "linked in", "linkdin", "connect", "in touch", "get in touch", "message", "call", "talk to", "github", "git hub", "twitter", "instagram", "facebook", "social", "socials", "dm", "phone number", "meet dimitri", "talk to dimitri", "talk with", "get ahold", "reach out"], "a": "The fastest way to reach Dimitri is email or LinkedIn. Links to GitHub, Instagram, and Facebook are at the bottom of the page too.", "go": [["Show me how", "#contact"]]},
		{"id": "resume", "q": "Can I get Dimitri's resume?", "keys": ["resume", "cv", "download", "pdf", "hire", "hiring", "recruit", "recruiter", "interview", "job opening", "opportunity", "role for", "position for"], "a": "This page walks through the whole career, camp by camp. For a resume or to talk about a role, email Dimitri or connect on LinkedIn.", "go": [["Get in touch", "#contact"], ["Start at the summit", "#summit"]]},
		{"id": "fit", "q": "Why would Dimitri be a good fit?", "keys": ["why hire", "why should", "good fit", "fit for", "a fit", "stand out", "unique", "different", "best at", "why dimitri", "sell me", "pitch", "strongest", "anthropic role", "applied ai", "architect role", "why should we hire", "why hire dimitri", "qualified", "qualifications"], "a": "The trail makes the case: an AI RFP workflow on Claude with an eval harness behind it, five years as an AWS Solutions Architect working with SI and ISV partners, and a Ripple team led as a player-coach. For a specific role, email Dimitri or reach out on LinkedIn.", "go": [["Show me the summit", "#summit"], ["Get in touch", "#contact"]]},
		{"id": "photos", "q": "Where are the photos from?", "keys": ["photo", "photos", "picture", "pictures", "pics", "pic", "image", "images", "gallery", "colorado", "vermont", "utah", "switzerland", "swiss", "alps", "whistler", "british columbia", "breckenridge", "vail", "stowe", "park city", "been to", "places", "travel ", "travels", "traveled", "travelled", "portrait", "headshot", "that photo", "taken"], "a": "The photos are from Colorado (Breckenridge, Vail, Keystone), Vermont (Stowe, Ascutney, Camel's Hump), Park City in Utah, Whistler in British Columbia, and Murren and Interlaken in Switzerland.", "go": [["Show me the photos", "#mountains"]]},
		{"id": "hobbies", "q": "What does Dimitri do for fun?", "chip": 7, "keys": ["fun", "hobby", "hobbies", "free time", "spare time", "time off", "outside work", "outside of work", "weekend", "snowboard", "snow board", "ski", "skiing", "hike", "hiking", "trail", "mountain", "mountains", "outdoor", "climb", "interests", "passion", "for fun"], "a": "Most of Dimitri's time off is spent in the mountains, on a snowboard or a trail.", "go": [["Show me the photos", "#mountains"]]},
		{"id": "location", "q": "Where is Dimitri based?", "keys": ["where is dimitri", "where does dimitri live", "where do you live", "where does he live", "located", "location", "new york", "nyc", "home", "from where", "where are you", "timezone", "time zone", "live in", "lives", "based in", "based out", "what city", "u live", "whr", "ny"], "a": "The page lists New York, NY for Dimitri's roles at Ripple and AWS. Before that, Travelers was in Hartford, CT.", "go": [["Show me Ripple", "#camp3"]]},
		{"id": "site", "q": "How was this site built?", "keys": ["site", "website", "web site", "this page", "built this", "made this", "make this", "dimitri cole designs", "built with", "how was this", "tech behind", "source code", "framework", "cole designs", "who designed this", "site design", "web design", "this built", "built with claude"], "a": "It's a Dimitri Cole Designs site, built with Claude Code. The guide is scripted, with every answer written in advance.", "go": [["Show me the footer", "#contact"]]},
		{"id": "salary", "q": "What is Dimitri's salary?", "keys": ["salary", "salaries", "compensation", "comp", "pay", "paid", "make a year", "earnings", "income", "money", "expectations", "how much does", "equity", "bonus", "how much do", "much do you make"], "a": "Compensation isn't something this page covers. That's a conversation for email or LinkedIn.", "go": [["Get in touch", "#contact"]]},
		{"id": "availability", "q": "Is Dimitri open to new roles?", "keys": ["available", "availability", "open to", "looking for", "job search", "job hunting", "new job", "new role", "leaving", "leave ripple", "relocat", "move", "remote", "hybrid", "in office", "in-office", "visa", "sponsor", "citizen", "work authorization", "authorized", "notice period", "start date", "when can", "freelance", "contract", "consult"], "a": "The page doesn't cover availability, relocation, or work authorization. Those are best asked directly, by email or on LinkedIn.", "go": [["Get in touch", "#contact"]]},
		{"id": "personal", "q": "Tell me something personal about Dimitri.", "keys": ["age", "old", "how old", "born", "birthday", "married", "wife", "husband", "girlfriend", "boyfriend", "single", "kids", "children", "family", "religion", "religious", "politic", "vote", "democrat", "republican", "pets", "dog", "cat", "favorite", "favourite", "personal", "height", "tall"], "a": "The guide keeps to what's on the page, and that isn't here. Dimitri is easiest to reach by email or LinkedIn.", "go": [["Get in touch", "#contact"]]},
		{"id": "advice", "q": "Should I buy XRP?", "keys": ["buy", "sell", "invest", "investment", "price", "prices", "worth", "moon", "financial advice", "should i buy", "portfolio advice", "going up", "trading", "trade", "bitcoin", "btc", "pump"], "a": "The guide can't give price or investment advice. What it can show is the work Dimitri does with banks on custody, stablecoins, and tokenized deposits.", "go": [["Show me the summit", "#summit"]]},
		{"id": "joke", "q": "Tell me a joke", "keys": ["joke", "jokes", "funny", "laugh", "lol", "lmao", "haha", "riddle", "meaning of life", "poem", "weather", "bored"], "a": "The guide's jokes weren't written in advance, so there aren't any. The mountain photos are a good consolation, though.", "go": [["Show me the photos", "#mountains"]]},
		{"id": "ai", "q": "What AI work has Dimitri done?", "chip": 2, "keys": ["ai", "artificial intelligence", "genai", "gen ai", "generative", "llm", "llms", "large language", "machine learning", "ml", "models", "prompt", "rag", "nlp", "ai experience", "ai work", "a i", "llm experience", "llm work", "ai background", "with ai", "in ai", "about ai", "ai projects", "ai stuff", "use ai", "experience with ai", "ai systems", "kind of ai", "ai has", "ai built", "ai did"], "a": "At Ripple, Dimitri designed an AI RFP workflow with Claude on Amazon Bedrock, with an eval harness that scores every run, and built the team's demo tools with Claude Code. At AWS, Dimitri designed the AWS architecture for a multi-provider AI layer in a healthcare platform and scoped LLM fine-tuning for a mental health platform.", "go": [["Show me the summit", "#summit"], ["Show me AWS", "#camp2"]]},
		{"id": "skills", "q": "What are Dimitri's skills?", "keys": ["skill", "skills", "skillset", "skill set", "strength", "expertise", "good at", "specialt", "specializ", "capabilit", "competenc", "tools", "toolkit"], "a": "AI and LLMs (the Claude API, Claude Code, Claude on Amazon Bedrock, agentic workflows, MCP, evals, fine-tuning), digital assets (XRPL, Ethereum, stablecoins, custody), pre-sales and enablement, programming in TypeScript, Python, and C#, and AWS architecture.", "go": [["Show me the skills", "#skills"]]},
		{"id": "current-role", "q": "What does Dimitri do now?", "chip": 1, "keys": ["current", "currently", "right now", "these days", "nowadays", "do now", "doing now", "job", "role", "title", "position", "do you do", "do u do", "does he do", "does dimitri do", "who is dimitri", "whos dimitri", "about dimitri", "about yourself", "about you", "introduce", "director", "occupation", "profession", "work now", "working on", "who s dimitri", "for a living", "up to", "lately", "where does dimitri work", "where do you work", "where does he work", "where do u work", "work at"], "a": "Dimitri is a Customer Solutions Director at Ripple in New York, helping banks adopt digital asset custody and payments, after five years at AWS, most recently as a Senior Solutions Architect.", "go": [["Take me to Ripple", "#camp3"], ["What Dimitri works on now", "#summit"]]},
		{"id": "career", "q": "Where has Dimitri worked?", "chip": 5, "keys": ["worked", "work history", "career", "background", "companies", "employers", "employment", "previous jobs", "past jobs", "how many years", "years of experience", "timeline", "journey", "path", "overview", "work experience", "your experience", "professional experience", "prior experience", "past experience"], "a": "Ripple since Aug 2025, AWS from Sep 2020 to Aug 2025, and Travelers from Feb 2016 to Aug 2020, after an MBA and BS at Quinnipiac University.", "go": [["Start with Ripple", "#camp3"]]},
		{"id": "thanks", "q": "Thanks!", "keys": ["thanks", "thank you", "thank u", "thx", "ty", "appreciate", "bye", "goodbye", "good bye", "see ya", "see you", "cheers", "great", "awesome", "nice", "ok", "okay"], "a": "Safe travels. If you'd like to talk with Dimitri, the email and LinkedIn links are at the bottom of the page.", "go": [["Get in touch", "#contact"]]}
	];
	var FALLBACK = "I don't have a written answer for that one. Try one of the questions below, or send Dimitri an email.";

	var ask = document.getElementById('ask');
	var askLog = document.getElementById('ask-log');
	var askChips = document.getElementById('ask-chips');
	var askForm = document.getElementById('ask-form');
	var askInput = document.getElementById('ask-input');
	var fab = document.getElementById('ask-fab');

	function match(text) {
		var t = ' ' + text.toLowerCase().replace(/[^a-z0-9\- ]/g, ' ') + ' ';
		var best = null, bestScore = 0;
		QA.forEach(function (item) {
			var score = 0;
			item.keys.forEach(function (k) {
				// Short keys must stand alone ("ai" should not match "mail")
				if (k.length <= 3 ? t.indexOf(' ' + k + ' ') > -1 : t.indexOf(k) > -1) score += k.length > 3 ? 2 : 1;
			});
			if (score > bestScore) { best = item; bestScore = score; }
		});
		return best;
	}

	function reply(question, item) {
		askLog.appendChild(el('div', 'msg msg-user', question));
		var answer = el('div', 'msg msg-agent', item ? item.a : FALLBACK);
		askLog.appendChild(answer);
		var links = item ? item.go : [['Email Dimitri', 'mailto:dimitri.code@gmail.com?Subject=Hello%20There']];
		links.forEach(function (g) {
			var b = el('button', 'ask-go', g[0]);
			b.type = 'button';
			b.addEventListener('click', function () { travel(g[1]); });
			askLog.appendChild(b);
		});
		askLog.scrollTop = askLog.scrollHeight;
	}

	// Scroll so the target's box sits just under the top bar, whole and readable.
	function land(target) {
		autoScrolling = true;
		clearTimeout(autoTimer);
		autoTimer = setTimeout(function () { autoScrolling = false; }, 1400);
		if (target.id === 'top') { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return target; }
		var box = target.matches('.panel, .day-inner, .agents') ? target : target.querySelector('.panel, .day-inner') || target;
		var y = box.getBoundingClientRect().top + window.scrollY - LANDING;
		window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
		return box;
	}

	function travel(href, fromTour) {
		if (href.indexOf('mailto:') === 0) { window.location.href = href; return; }
		if (ask.open) ask.close();
		if (!fromTour) endTour();
		var target = document.querySelector(href);
		if (!target) return;
		var box = land(target);
		var flag = box.classList.contains('agents') ? box.closest('.panel') : box;
		Array.prototype.forEach.call(document.querySelectorAll('.is-flagged'), function (n) { n.classList.remove('is-flagged'); });
		if (target.id !== 'top') {
			flag.classList.add('is-flagged');
			setTimeout(function () { flag.classList.remove('is-flagged'); }, 2200);
		}
		var heading = box.querySelector('h2, h3');
		if (heading && !fromTour) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
	}

	// In-page links (rail, Start the descent, home pill) land the same way.
	document.addEventListener('click', function (e) {
		var a = e.target.closest('a[href^="#"]');
		if (!a || a.classList.contains('skip')) return;
		var target = document.querySelector(a.getAttribute('href'));
		if (!target) return;
		e.preventDefault();
		land(target);
		history.replaceState(null, '', a.getAttribute('href'));
	});


	QA.filter(function (i) { return i.chip; }).sort(function (a, b) { return a.chip - b.chip; }).forEach(function (item) {
		var b = el('button', null, item.chipText || item.q);
		b.type = 'button';
		b.addEventListener('click', function () { reply(item.q, item); });
		askChips.appendChild(b);
	});

	askForm.addEventListener('submit', function (e) {
		e.preventDefault();
		var text = askInput.value.trim();
		if (!text) return;
		reply(text, match(text));
		askInput.value = '';
	});

	function openAsk() {
		if (!askLog.childElementCount) {
			askLog.appendChild(el('div', 'msg msg-agent', "Here are a few things I can tell you about Dimitri. Pick one, or type a question."));
		}
		fab.classList.remove('is-greeting');
		ask.showModal();
	}

	Array.prototype.forEach.call(document.querySelectorAll('[data-ask]'), function (b) { b.addEventListener('click', openAsk); });
	document.getElementById('ask-close').addEventListener('click', function () { ask.close(); });
	var tipBtn = document.getElementById('tip-btn');
	tipBtn.addEventListener('click', function () {
		tipBtn.setAttribute('aria-expanded', tipBtn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
	});
	ask.addEventListener('close', function () { tipBtn.setAttribute('aria-expanded', 'false'); });
	ask.addEventListener('click', function (e) { if (e.target === ask) ask.close(); });

	/* ---------- The guided tour ---------- */

	var TOUR = [
		{ at: '#top', text: "Welcome, traveler. You stand at the summit of Dimitri's trail, where the work is AI, blockchain, and agentic finance. The path runs down through every camp from here. Shall we descend together?" },
		{ at: '#summit', text: 'The summit is what Dimitri works on now. Just below waits a small sketch: an agent reads a ledger, then asks before it moves any money.' },
		{ at: '#camp3', text: "Camp 3 is Ripple, since Aug 2025. Dimitri leads the North America Customer Solutions team as a player-coach, and builds a lot: an AI RFP workflow on Claude, the team's demo tools with Claude Code, and internal MCP servers for XRPL." },
		{ at: '#camp2', text: 'Camp 2 is five years at AWS, where Dimitri got into generative AI early, including the AWS architecture for an AI layer in a healthcare platform.' },
		{ at: '#base', text: 'Camp 1 is Travelers, 2016 to 2020, where Dimitri led seven developers plus an Accenture delivery team. Quinnipiac waits just below.' },
		{ at: '#talks', text: 'Back at the trailhead: talks and writing, including three XRPL Apex talks and an AWS post on generative AI workflows.' },
		{ at: '#skills', text: 'The skills Dimitri gathered along the way, from Claude and MCP to XRPL, Python, and AWS.' },
		{ at: '#mountains', text: 'And this is where Dimitri spends time off the clock.' },
		{ at: '#contact', text: "That's the whole trail. To talk with Dimitri, email or LinkedIn is fastest. I'll be here in the corner if you have questions." }
	];

	var tour = document.getElementById('tour');
	var tourStep = document.getElementById('tour-step');
	var tourText = document.getElementById('tour-text');
	var tourActions = document.getElementById('tour-actions');
	var step = -1, tourOpener = null;

	function tourButton(label, cls, fn) {
		var b = el('button', cls, label);
		b.type = 'button';
		b.addEventListener('click', fn);
		tourActions.appendChild(b);
		return b;
	}

	var waveTimer;
	function wave() {
		fab.classList.remove('is-greeting');
		void fab.offsetWidth;
		fab.classList.add('is-greeting');
		clearTimeout(waveTimer);
		waveTimer = setTimeout(function () { fab.classList.remove('is-greeting'); }, 2000);
	}

	function goTo(i, focusFirst, following) {
		step = i;
		var s = TOUR[i];
		tour.hidden = false;
				fab.classList.add('is-touring');
		tourStep.textContent = i === 0 ? 'Your guide' : 'Stop ' + i + ' of ' + (TOUR.length - 1);
		tourText.textContent = s.text;
		tourActions.innerHTML = '';
		var first;
		if (i === 0) {
			first = tourButton('Take the tour', 'primary', function () { goTo(1, true); });
			tourButton('Ask a question', '', function () { tour.hidden = true; step = -1; fab.classList.remove('is-touring'); openAsk(); });
		} else if (i < TOUR.length - 1) {
			tourButton('Back', '', function () { goTo(i - 1, true); });
			first = tourButton('Next', 'primary', function () { goTo(i + 1, true); });
		} else {
			tourButton('Ask a question', '', function () { tour.hidden = true; step = -1; fab.classList.remove('is-touring'); openAsk(); });
			first = tourButton('Done', 'primary', endTour);
		}
		if (i > 0 && !following) travel(s.at, true);
		if (!following) wave();
		if (focusFirst) first.focus({ preventScroll: true });
	}

	function endTour() {
		if (step === -1) return;
		var hadFocus = tour.contains(document.activeElement);
		tour.hidden = true;
		fab.classList.remove('is-touring');
		step = -1;
		if (hadFocus) (tourOpener || fab).focus({ preventScroll: true });
		tourOpener = null;
	}

	document.getElementById('tour-close').addEventListener('click', endTour);
	// While the card is open, the guide follows a visitor who scrolls on their own.
	function stopInView() {
		var line = window.innerHeight * 0.45;
		for (var i = TOUR.length - 1; i > 0; i--) {
			var t = document.querySelector(TOUR[i].at);
			var b = t.querySelector('.panel, .day-inner') || t;
			if (b.getBoundingClientRect().top <= line) return i;
		}
		return 0;
	}
	var following = false;
	window.addEventListener('scroll', function () {
		if (step === -1 || autoScrolling || following) return;
		following = true;
		requestAnimationFrame(function () {
			following = false;
			var i = stopInView();
			if (i !== step) goTo(i, false, true);
		});
	}, { passive: true });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && step !== -1 && !ask.open) endTour(); });
	Array.prototype.forEach.call(document.querySelectorAll('[data-tour]'), function (b) {
		b.addEventListener('click', function () { tourOpener = b; goTo(1, true); });
	});

	// The guide introduces Dimitri on every visit, once the page settles.
	setTimeout(function () {
		if (ask.open || step !== -1 || window.scrollY > window.innerHeight * 0.5) return;
		goTo(0, false);
	}, 1600);

	/* ---------- Lightbox ---------- */

	var box = document.getElementById('lightbox');
	var items = Array.prototype.slice.call(document.querySelectorAll('#gallery a'));
	var lbImg = document.getElementById('lb-img'), lbCap = document.getElementById('lb-cap');
	var at = 0;

	function show(i) {
		at = (i + items.length) % items.length;
		lbImg.src = items[at].getAttribute('href');
		lbImg.alt = lbCap.textContent = items[at].dataset.caption;
	}

	if (box.showModal) {
		items.forEach(function (a, i) {
			a.addEventListener('click', function (e) { e.preventDefault(); show(i); box.showModal(); });
		});
		document.getElementById('lb-prev').addEventListener('click', function () { show(at - 1); });
		document.getElementById('lb-next').addEventListener('click', function () { show(at + 1); });
		document.getElementById('lb-close').addEventListener('click', function () { box.close(); });
		box.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowLeft') show(at - 1);
			if (e.key === 'ArrowRight') show(at + 1);
		});
		box.addEventListener('click', function (e) { if (e.target === box || e.target.tagName === 'FIGURE') box.close(); });
		box.addEventListener('close', function () { lbImg.removeAttribute('src'); items[at].focus(); });
		var sx = null;
		box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
		box.addEventListener('touchend', function (e) {
			if (sx == null) return;
			var dx = e.changedTouches[0].clientX - sx;
			if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
			sx = null;
		});
	}
})();
