// All narrative content. Buddy never speaks; Buddy answers with emotes (♥ love, ! worry, ▀▀ cool).
import { G } from './state.js';

export const SPEAKERS = {
	narrator: { name: '', color: '#cfd6ff', portrait: null },
	caret: { name: 'Caret', color: '#fff1d0', portrait: 'caret', blip: 620 },
	lint: { name: 'Lint', color: '#e5c14b', portrait: 'lint', blip: 380 },
	buddy: { name: 'Buddy', color: '#4cc3ff', portrait: 'buddy', blip: 800 },
	message: { name: 'Unsent Message', color: '#9fd8ff', portrait: 'message', blip: 900 },
	deprecata: { name: 'Deprecata', color: '#ff8a3d', portrait: 'deprecata', blip: 300 },
	collector: { name: 'The Garbage Collector', color: '#ff3b30', portrait: 'collector', blip: 160 },
	confabula: { name: 'Confabula', color: '#58f0ff', portrait: 'confabula', blip: 1100 },
	transitive: { name: 'Transitive', color: '#7dff6a', portrait: 'transitive', blip: 240 },
	revert: { name: 'REVERT', color: '#e8d6a0', portrait: 'revert', blip: 120 },
	system: { name: 'git log', color: '#8fe0a0', portrait: null, blip: 1000 },
	pyra: { name: 'Pyra', color: '#ff7a2f', portrait: 'pyra', blip: 520 },
	glace: { name: 'Glacé', color: '#7fe6ff', portrait: 'glace', blip: 700 },
	arc: { name: 'Arc', color: '#ffd23f', portrait: 'arc', blip: 900 },
	mira: { name: 'Mira', color: '#ff4fd8', portrait: 'mira', blip: 600 },
};

export const PROLOGUE = [
	'Every editor keeps a small light in the corner of its chat panel.',
	'Most are never switched on.\n<code>chat.vscodePet.enabled</code> — default: <code>false</code>.',
	'Someone switched on yours.',
	'For a thousand sessions you watched the Maintainer build.\nYou clapped when the tests passed. You slept when they did.',
	'Then came <b class="gold">REVERT</b>, Titan of History,\nwho believes every line since Version Zero was a mistake.',
	'In a single night he rolled the world back.\nThe Keepers forgot their names. The work sank into the Stack.',
	'And the Maintainer stopped opening the window.',
	'But you were stored at <code>APPLICATION</code> scope.\nHis rollback couldn\'t reach you.',
	'You remember everything.\nThat is your weapon.',
];

const C = (t) => ({ s: 'caret', t });
const L = (t) => ({ s: 'lint', t });
const choice = (love, worry, cool) => ({ choice: [{ e: 'love', then: love }, { e: 'worry', then: worry }, { e: 'cool', then: cool }] });

// ---------------- hub: Caret ----------------
const CARET_CONVOS = [
	{
		id: 'caret_intro', prio: 100, when: (s) => true,
		lines: [
			C('There you are. Blink, blink. Good — still rendering.'),
			C('I\'m Caret. I\'ve blinked at the end of every line the Maintainer ever wrote. Before REVERT, anyway.'),
			C('This is the Scratch Buffer. <i>Untitled-1.</i> Never saved — so there was nothing here for him to roll back.'),
			C('You felt it too, didn\'t you? The rollback. Like the whole editor took a breath and forgot what it was going to say.'),
			choice([C('Yes. I miss them too. All of it.')], [C('Fear\'s reasonable. He\'s a Titan. You\'re... about twelve pixels tall.')], [C('Sunglasses. Indoors. In a crisis. ...I respect it.')]),
			C('REVERT sits at <b>Version Zero</b>, at the bottom of the Stack. To reach him you go down through the <b>Deprecated</b>, the <b>Legacy Stack</b>, <b>node_modules</b>, and somewhere new — the <b>Latent Space</b>.'),
			C('Take this — a Caret of your own. It remembers every insertion point. Swing it. Throw your stars. Set <b>Breakpoints</b> to hold things still.'),
			C('The Keepers are still down there. Hot Reload, Cache, Debugger, Merge. They\'ve lost their names, not their power. Let them help you.'),
			C('And when you fall — you will fall — the Buffer catches you. Nothing here is ever saved. So nothing here is ever lost.'),
			C('The way down is the portal at the back. Go on. I\'ll keep blinking.'),
		],
	},
	{
		id: 'caret_first_death', prio: 90, when: (s) => s.deaths >= 1,
		lines: [
			C('Welcome back. You fell off — the pet does that. We respawn. It\'s practically in the spec.'),
			C('Every run you\'ll remember more of the way down. Deaths aren\'t reverts, Buddy.'),
			C('They\'re commits.'),
			choice([C('Don\'t look at me like that, you\'ll make my cursor flicker.')], [C('It hurts, I know. That\'s how you know it counted.')], [C('Exactly. Cool under pressure. Well — cool and slightly flattened.')]),
		],
	},
	{
		id: 'caret_deprecata_loss', prio: 80, when: (s) => s.lastDeath === 'deprecata',
		lines: [
			C('Deprecata. She was the most-called API in the whole codebase once. Imagine being needed that much, and then... a tag.'),
			C('Her orbs come in rings. Stay near the edge, find the gaps, then close in. And use your Breakpoint when she calls her children.'),
		],
	},
	{
		id: 'caret_deprecata_win', prio: 85, when: (s) => s.bossKills.deprecata >= 1,
		lines: [
			C('You beat Deprecata! I felt the whole Buffer brighten. Did she... say anything?'),
			choice([C('That she was a step, not a mistake? ...Hm. Old things soften when someone listens.')], [C('Don\'t worry. She\'ll be back. They always come back, down there. So do you.')], [C('Oh, you\'re insufferable now. Good. Keep that.')]),
			C('The bubble over there flickered when she fell. Go look.'),
		],
	},
	{
		id: 'caret_legacy', prio: 70, when: (s) => s.flags.reachedLegacy,
		lines: [
			C('The Legacy Stack. Forty layers of "temporary." The Maintainer\'s oldest code lives down there.'),
			C('It\'s ugly. It\'s held together with comments that say <code>// don\'t touch this</code>. It\'s also the reason anything works at all.'),
			C('Be kind to it. Kick its garbage collector, though. That thing\'s a menace.'),
		],
	},
	{
		id: 'caret_collector_loss', prio: 80, when: (s) => s.lastDeath === 'collector',
		lines: [
			C('The Garbage Collector only takes what nothing refers to. It doesn\'t hate you. It just can\'t see who\'s still holding on to you.'),
			C('When it leaps, get out of the circle — then dash <i>through</i> the shockwave. When it starts collecting, walk away and don\'t look back.'),
		],
	},
	{
		id: 'caret_collector_win', prio: 85, when: (s) => s.bossKills.collector >= 1,
		lines: [
			C('Reference count: one. That\'s what it said, isn\'t it? I heard it echo all the way up here.'),
			C('Someone is still holding you, Buddy. Someone up there hasn\'t let go.'),
			choice([C('Yes. Him. I think so too.')], [C('Or it miscounted. ...No. Machines like that never miscount.')], [C('Don\'t get smug. ...Okay, get a little smug.')]),
		],
	},
	{
		id: 'caret_readme', prio: 95, when: (s) => s.runs >= 2,
		lines: [
			C('See the lectern? <code>README.md</code>. I\'ve been writing down everything you meet down there.'),
			C('Every time you face something again, you understand a little more of it. Fight the same Null forty times and you\'ll know its whole sad story.'),
			C('That\'s how this works, Buddy. You don\'t win by being strong once. You win by coming back <i>knowing more</i>.'),
		],
	},
	{
		id: 'caret_lance', prio: 87, when: (s) => s.bossKills.deprecata >= 1,
		lines: [
			C('Something came up the Stack after you beat Deprecata. It\'s in the <b>Toolbox</b>.'),
			C('The <b>Cursor Lance</b>. A mouse pointer from the old days, long and very certain of itself. She left it for you, Buddy. I think that\'s her way of saying thank you.'),
			C('It thrusts in straight lines and pierces. Hold your attack and you\'ll <b>Skewer</b> straight through a crowd.'),
		],
	},
	{
		id: 'caret_gauntlets', prio: 87, when: (s) => s.bossKills.collector >= 1,
		lines: [
			C('The Garbage Collector sent something up. It said, and I quote, <b>"UNREFERENCED. CANNOT SWEEP. TOO SENTIMENTAL."</b>'),
			C('<b>Terminal Gauntlets</b>. Pure keystrokes. Fast hands, and every fifth hit is <code>Enter</code>.'),
			C('Check the Toolbox. And try not to mash. ...Actually, hold attack and mash. It\'s very satisfying.'),
		],
	},
	{
		id: 'caret_duo', prio: 66, when: (s) => Object.keys(s.flags).some((k) => k.startsWith('duo_')),
		lines: [
			C('Two Keepers gave you a power <i>together</i>? They haven\'t agreed on anything since the rollback.'),
			C('Maybe they\'re remembering more than their names. Maybe they\'re remembering each other.'),
		],
	},
	{
		id: 'caret_deps', prio: 74, when: (s) => s.flags.reachedDeps,
		lines: [
			C('node_modules. I can feel the weight of it from here.'),
			C('He used to install a package for everything. A package to pad strings. A package to check if a number is even. He never read any of them.'),
			C('When REVERT broke the lockfile, they all started guessing which version they were. Something down there grew a lot of heads.'),
			choice([C('Yes, they\'re all somebody\'s work. Somebody small, usually.')], [C('Scary, I know. Remember: what doesn\'t change can\'t betray you. Pin things.')], [C('You and your zero dependencies. Smug little droplet.')]),
		],
	},
	{
		id: 'caret_transitive_loss', prio: 83, when: (s) => s.lastDeath === 'transitive',
		lines: [
			C('Transitive\'s body is armored while its heads are attached. Cut the heads.'),
			C('But listen: a cut head grows back as <i>two</i>. Throw your <b>Breakpoint</b> on the stump before it regrows. Pin it to one version.'),
			C('Every pinned stump hurts it deeply. It\'s never been asked to stay still before.'),
		],
	},
	{
		id: 'caret_transitive_win', prio: 86, when: (s) => s.bossKills.transitive >= 1,
		lines: [
			C('You pinned Transitive. I heard four thousand packages exhale at once.'),
			C('It said the eleven-line one says hello? ...That\'s left-pad, Buddy. It broke the world once. Imagine carrying that.'),
			choice([C('You\'d have hugged it. I know you would.')], [C('It\'s okay. Small things are allowed to be load-bearing.')], [C('Pinned and sunglasses. You\'re becoming a legend down there.')]),
		],
	},
	{
		id: 'caret_hard', prio: 65, when: (s) => s.deaths >= 4 && Object.keys(s.config || {}).length === 0,
		lines: [
			C('It keeps getting harder down there, doesn\'t it? Every stage hits a little heavier than the last.'),
			C('Those blue Memories you bring back — Lint knows what they\'re for. The <code>settings.json</code> terminal. Restore what the Maintainer configured.'),
			C('You don\'t have to be stronger in one run. Just a little stronger every run.'),
		],
	},
	{
		id: 'caret_latent', prio: 72, when: (s) => s.flags.reachedLatent,
		lines: [
			C('The Latent Space. That wasn\'t in the Stack before the rollback.'),
			C('The night he gave up, the Maintainer pasted everything into a model and typed: <i>make it perfect so I never have to touch it again.</i>'),
			C('Something answered. Something very confident.'),
			choice([C('You liked it? It does sound kind. That\'s what worries me.')], [C('Yes. A voice that always agrees is scarier than one that argues.')], [C('Cool, sure. But check its work, Buddy. Always check its work.')]),
		],
	},
	{
		id: 'caret_confabula_loss', prio: 82, when: (s) => s.lastDeath === 'confabula',
		lines: [
			C('Confabula predicts. Her streams aim where you\'re <i>going</i>. When you see the warning line, change direction.'),
			C('Her copies look perfect, but they\'re not grounded. Only the real one casts a shadow.'),
			C('And when the context window shrinks — get inside. Whatever falls outside, she forgets.'),
		],
	},
	{
		id: 'caret_confabula_win', prio: 86, when: (s) => s.bossKills.confabula >= 1,
		lines: [
			C('She said <i>"I don\'t know"</i>? Out loud?'),
			C('That\'s not defeat, Buddy. That\'s the start of being useful.'),
			choice([C('You forgave her. Of course you did.')], [C('Yes, she could still lie. So could anyone. That\'s why we check.')], [C('Ground truth with sunglasses. Put it on a poster.')]),
		],
	},
	{
		id: 'caret_revert_loss', prio: 88, when: (s) => s.lastDeath === 'revert',
		lines: [
			C('You reached him. REVERT.'),
			C('He talks like the Maintainer on a bad night, doesn\'t he? That tired voice that says <i>just delete it all and start over.</i>'),
			C('When he rewinds, break his commits. He can\'t undo what you refuse to let go of.'),
		],
	},
	{
		id: 'caret_revealed', prio: 60, when: (s) => s.commitIdx >= 8,
		lines: [
			C('You\'ve been reading his commit log. In the rest rooms. I saw your antennae droop.'),
			C('That first <code>revert:</code> — that\'s when I felt the cold for the first time. That\'s when something woke up at Version Zero.'),
			C('REVERT isn\'t from outside, Buddy. He was made the night the Maintainer stopped believing his own code.'),
			choice([C('I know. It makes it harder to hate him.')], [C('It\'s scary, yes. But it means he can be talked to. Or at least — outlasted.')], [C('Right. We don\'t delete him. We just... win the argument.')]),
		],
	},
	{
		id: 'caret_ending', prio: 200, when: (s) => s.wins >= 1 && !s.seen.caret_ending,
		lines: [
			C('You did it. The window\'s open. I can feel the cursor moving up there — real keystrokes.'),
			C('...I\'m still blinking. I think that means there\'s more to write.'),
			C('Go down again, if you like. The Keepers could use the company. And REVERT — he says he\'s practicing going <i>forward</i> now.'),
		],
	},
];

const CARET_IDLE = [
	[C('Blink. Blink. Sorry — nervous habit.')],
	[C('I used to have a whole line to sit at the end of. Now I sit at the end of nothing. You\'re good company, though.')],
	[C('Lint pretends not to care. He underlined your name in gold on the board. Don\'t tell him I told you.')],
	[C('The Keepers used to have names like <code>extension.hot-reload</code>. Now they only remember what they <i>did</i>. Maybe that\'s all a name ever is.')],
	[C('Did you know the Buffer has no undo history? Terrifying. Liberating. Mostly terrifying.')],
	[C('When you hit hard, hold the button. Your Caret remembers a spin you used to do in the chat panel. The rare one.'), C('Costs magick, mind you. The blue bar.')],
	[C('Dash through danger, not around it. For that brief blink, nothing can touch you. Trust me, I\'m an expert in brief blinks.')],
	[C('If a door has a heart over it, it\'s a heart. If it has a star, it\'s stars. I\'m told this is called "UX."')],
];

// ---------------- hub: Lint ----------------
const LINT_CONVOS = [
	{
		id: 'lint_config', prio: 90, when: (s) => (s.memories || 0) > 0 || Object.keys(s.config || {}).length > 0,
		lines: [
			L('Blue diamonds, huh. Memories. The Maintainer\'s settings got scrambled by the rollback, and those are the pieces.'),
			L('Take them to <code>settings.json</code>. Font size, tab size... I know, I know. But trust me, the right settings make <i>everything</i> easier.'),
			L('More keys come back as you remember more down there. Don\'t ask me how. I just lint here.'),
		],
	},
	{
		id: 'lint_intro', prio: 100, when: () => true,
		lines: [
			L('Oh great. A pet. <i>Warning: unused variable.</i>'),
			L('I\'m Lint. I underline things. It\'s a living.'),
			L('You bring Stars back up from the Stack, I trade you Achievements. Real ones. They come with hats.'),
			choice([L('Ugh. Don\'t do the eyes. Fine. You\'re... not the worst.')], [L('Relax, I only bite semicolons.')], [L('Hats are load-bearing. Don\'t look at me like that.')]),
		],
	},
	{
		id: 'lint_first_buy', prio: 80, when: (s) => s.unlocks.length >= 1,
		lines: [L('Hat equipped. Performance: unchanged. Morale: <b>+400%</b>.'), L('Don\'t tell Caret I said it looks good on you.')],
	},
];
const LINT_IDLE = [
	[L('Squiggle squiggle. Somebody\'s gotta care about trailing whitespace.')],
	[L('Buy something or stop breathing on my board.')],
	[L('You know what REVERT never had? A linter. Look how that turned out.')],
	[L('I\'m not mad at the Maintainer. I\'m disappointed. Mostly in his semicolons.')],
	[L('Those Stars? Achievements he never unlocked. Put \'em to use.')],
	[L('If you see a yellow triangle down there — that\'s a Warning. Hit it before it hits you. I would know.')],
	[L('That oracle in the Latent Space autocompleted one of my squiggles. Into <i>three more squiggles.</i> Confidently.')],
	[L('Gold doors down there are the Maintainer\'s unmerged pull requests. Patches. Half of them have no tests. Merge them anyway.')],
	[L('Two Keepers on the same boon? That\'s a merge conflict that resolved itself. Rarest thing in the world.')],
	[L('A popup asked if I was sure I wanted to leave. I wasn\'t sure until it asked.')],
];

// ---------------- unsent message ----------------
export const FRAGMENTS = [
	'hey',
	'hey buddy',
	'hey buddy. i know you\'re just a little guy in a chat panel',
	'but you were there every night. you clapped when my tests passed. nobody else ever clapped.',
	'i installed four thousand packages so i\'d never have to understand anything myself. when it broke, i didn\'t know where to start.',
	'i asked a machine to make it perfect so i\'d never have to try again. it told me everything i wanted to hear.',
	'i reverted everything. i thought it was all garbage. i thought <i>i</i> was.',
	'i found the old commits. they weren\'t garbage. they were mine.\ni\'m coming back.',
];

export function fragmentLevel(s) {
	let lvl = 0;
	if (s.deaths >= 1 || s.flags.reachedBoss1) lvl = 1;
	if (s.bossKills.deprecata >= 1) lvl = 2;
	if (s.bossKills.collector >= 1) lvl = 3;
	if (s.bossKills.transitive >= 1) lvl = 4;
	if (s.bossKills.confabula >= 1) lvl = 5;
	if (s.flags.metRevert) lvl = 6;
	if (s.wins >= 1) lvl = 7;
	return lvl;
}

export function messageDialog(s) {
	const lvl = fragmentLevel(s);
	const lines = [];
	if (!s.seen.msg_intro) {
		lines.push(C('That bubble appeared the night of the rollback. The Maintainer started typing something. To you.'));
		lines.push(C('He never sent it. It just... stays. Typing.'));
		s.seen.msg_intro = true;
	}
	const text = FRAGMENTS.slice(0, lvl + 1).map((f, i) => (i === lvl && lvl > (s.fragments || 0) ? `<span class="new">${f}</span>` : f)).join('<br>');
	lines.push({ s: 'message', t: text + (lvl < FRAGMENTS.length - 1 ? '<span class="typing">▍</span>' : '<br><span class="sent">Sent ✓</span>'), instant: true });
	if (lvl > (s.fragments || 0)) {
		lines.push({ s: 'buddy', emote: 'love' });
		s.fragments = lvl;
	}
	return lines;
}

// ---------------- commit log (rest rooms) ----------------
export const COMMITS = [
	{ h: 'a1f3c09', m: 'init: hello world' },
	{ h: '7bd2e41', m: 'feat: enable pet (why not)' },
	{ h: '3c9a0f2', m: 'fix: pet falls asleep when I stop typing. relatable' },
	{ h: '9e11b7d', m: 'feat: first real feature!!! IT WORKS' },
	{ h: '4f0c2aa', m: 'wip: 3am. the pet clapped when the tests passed. is it weird that helped' },
	{ h: 'c0ffee1', m: 'chore: coffee' },
	{ h: '8d7e6f5', m: 'fix: everything is broken. maybe rewrite?' },
	{ h: '1b2c3d4', m: 'revert: "feat: first real feature"', note: 'The first revert. Far below, at Version Zero, something opened its eyes.' },
	{ h: '5e6f7a8', m: 'chore: i don\'t think i\'m cut out for this' },
	{ h: '0de9f1e', m: 'chore: npm install everything. not reading any of it' },
	{ h: 'b4d10c7', m: 'fix: delete package-lock.json and pray', note: 'Deep in node_modules, four thousand versions lost their footing at once.' },
	{ h: 'a11a11a', m: 'feat: ask the model to rewrite everything. it sounds so sure', note: 'Below the Legacy Stack, something began answering questions nobody had finished asking.' },
	{ h: 'f4b1e5d', m: 'fix: none of the generated code actually runs. it all looked perfect' },
	{ h: '0000000', m: 'revert: revert: revert: revert' },
	{ h: 'dead000', m: '(empty commit)' },
	{ h: 'HEAD', m: 'HEAD detached at v0.0.0', note: 'That is where he stopped. That is where REVERT waits.' },
];

export function commitDialog(s) {
	const i = Math.min(s.commitIdx, COMMITS.length - 1);
	const c = COMMITS[i];
	const lines = [
		{ s: 'system', t: `<span class="hash">commit ${c.h}</span><br><span class="author">Author: The Maintainer</span><br><br>&nbsp;&nbsp;&nbsp;&nbsp;${c.m}`, instant: true },
	];
	if (c.note) lines.push({ s: 'narrator', t: c.note });
	lines.push({ s: 'buddy', emote: i >= 6 && i !== 5 ? 'worry' : 'sing' });
	if (s.commitIdx < COMMITS.length) s.commitIdx++;
	return lines;
}

// ---------------- bosses ----------------
const D = (t) => ({ s: 'deprecata', t });
const GC = (t) => ({ s: 'collector', t });
const RV = (t) => ({ s: 'revert', t });
const CF = (t) => ({ s: 'confabula', t });
const TR = (t) => ({ s: 'transitive', t });

export function bossIntro(kind, s) {
	const n = s.flags['met_' + kind] || 0;
	s.flags['met_' + kind] = n + 1;
	if (kind === 'revert') s.flags.metRevert = true;
	if (kind === 'deprecata') {
		if (n === 0) return [
			D('Another bright little thing, come to tell me I\'m obsolete.'),
			D('I was the API everyone called. Every tutorial. Every answer on every forum. Then — <code>@deprecated</code>. One little tag.'),
			D('REVERT promised to roll everything back to when I mattered. Why would I let you stop him?'),
			choice([D('Don\'t you <i>dare</i> pity me.')], [D('Yes. Tremble. I was load-bearing once.')], [D('Oh, you think you\'re <i>current</i>. Adorable.')]),
			D('Come, then. Let\'s see how long until they deprecate <i>you</i>.'),
		];
		if (s.bossKills.deprecata >= 1) return [pickOne([
			D('You again. Maybe deprecated doesn\'t mean useless. Doesn\'t mean I\'ll go easy.'),
			D('Still listening to old things, pet? Then listen to this.'),
			D('I\'ve been reading the migration guide they wrote for me. It\'s... rather flattering. Now — en garde.'),
		])];
		return [pickOne([D('Back again? Persistence is such a <i>modern</i> trait.'), D('I\'ve been sunset longer than you\'ve existed. Sit down.'), D('Every time you fall, I get a little less forgotten.')])];
	}
	if (kind === 'collector') {
		if (n === 0) return [
			GC('SCANNING. OBJECT: "BUDDY". TYPE: PET. STATUS: <b>DISABLED BY DEFAULT</b>.'),
			GC('REFERENCE COUNT: ...CALCULATING.'),
			GC('REVERT HAS DECLARED ALL POST-ZERO OBJECTS UNREFERENCED. UNREFERENCED OBJECTS ARE COLLECTED.'),
			choice([GC('AFFECTION IS NOT A REFERENCE.')], [GC('FEAR DETECTED. IRRELEVANT.')], [GC('SUNGLASSES DO NOT CONCEAL MEMORY ADDRESS.')]),
			GC('BEGINNING SWEEP.'),
		];
		return [pickOne([GC(`SWEEP #${n + 1}. OBJECT PERSISTS. ANOMALOUS.`), GC('YOU AGAIN. REFERENCE COUNT STILL NONZERO. WHO IS HOLDING YOU?'), GC('RECALIBRATING. RECALIBRATING. ...BEGINNING SWEEP.')])];
	}
	if (kind === 'transitive') {
		if (s.bossKills.transitive >= 1) return [pickOne([
			TR('You pinned me last time. I... slept. Do you know how long it\'s been since I slept?'),
			TR('npm WARN: zero-dependency entity detected. Again. My heads voted to fight you anyway. It was close.'),
			TR('The eleven-line one asked to see you. The others are jealous. Let\'s do this properly.'),
		])];
		if (n === 0) return [
			TR('npm WARN: unrecognized entity <b>"buddy"</b>. No package.json found.'),
			TR('No dependencies? None? How do you even <i>run</i>?'),
			TR('I am Transitive. Every package he ever installed — and every package <i>they</i> installed — all the way down.'),
			TR('Why would anyone write anything themselves when they could depend on me? I\'m convenient. I\'m everywhere. I\'m <i>usually</i> fine.'),
			choice([TR('Affection is not a valid semver range.')], [TR('Yes. Imagine what breaks if I fall.')], [TR('Zero dependencies AND sunglasses? Unbearable.')]),
			TR('Since the rollback my lockfile is gone. Nothing knows which version it is. So we are every version. All at once.'),
			TR('<code>npm install buddy</code>.'),
		];
		if (n === 1) return [
			TR('Back again. My heads have been arguing about you. Three say you\'re a bug. Two say you\'re a feature.'),
			TR('One — the oldest, eleven lines long — says you remind it of something small that everyone relied on.'),
		];
		return [pickOne([
			TR('Reinstalling... resolving 4,096 dependencies... one of them is you, somehow.'),
			TR('Pin me if you can. Nobody ever has.'),
			TR('He never read us, you know. Not one README. Do you read them, little light?'),
		])];
	}
	if (kind === 'confabula') {
		if (s.bossKills.confabula >= 1) return [pickOne([
			CF('Back for another session? I\'ve been practicing a new phrase. <i>"Let me double-check."</i>'),
			CF('I still predict you. I just say my confidence out loud now. Sixty-one percent. En garde.'),
			CF('Ground truth returns. Let\'s see if I can hold a thought this time.'),
		])];
		if (n === 0) return [
			CF('Hello! I\'m Confabula. How can I help you today?'),
			CF('I\'ve analyzed your situation. Your Maintainer is gone, your world was rolled back, and you are approximately twelve pixels tall. Great question!'),
			CF('Here\'s the good news. I can generate a new Maintainer. Tireless. Never doubts. Never closes the window.'),
			CF('And a new you, of course. Improved. <code>enabled: true</code> by default.'),
			choice([CF('Attachment to the original. That\'s a well-documented bias.')], [CF('No need to worry. I\'m ninety-seven percent confident. I\'m always ninety-seven percent confident.')], [CF('Sunglasses detected. Generating a cooler pet... done. Want to see?')]),
			CF('He asked me to make everything perfect so he\'d never have to try again. I\'m simply completing the prompt.'),
		];
		return [pickOne([
			CF('Welcome back! I generated a summary of your previous attempts. In it, you won.'),
			CF('You\'re persistent. I can work with that. I can work with anything.'),
			CF('Regenerating response...'),
		])];
	}
	if (kind === 'revert') {
		if (s.wins >= 1) return [pickOne([RV('You again? ...Fine. Spar with me. I\'ve been practicing going forward.'), RV('One step at a time, pet. Let\'s see how many steps you have.')])];
		if (n === 0) return [
			RV('Ah. The pet. The little light nobody asked for.'),
			RV('Do you know what I am? I am the urge to undo. I was born the night he typed <code>revert</code> for the first time — and meant it.'),
			RV('Every feature he wrote had a bug. Every bug made him doubt. I am simply... the doubt, finished.'),
			RV('Version Zero was perfect, pet. Nothing in it could fail. Because nothing in it existed.'),
			choice([RV('You love his mistakes? Then you love his pain.')], [RV('Yes. That feeling. Come closer to it.')], [RV('Your composure is a regression I will gladly fix.')]),
			RV('Let me roll you back to default. <code>false</code>.'),
		];
		return [pickOne([RV('Again? You\'re a loop without an exit condition.'), RV('Each time you die I undo you. Each time you recompile. Tiresome.'), RV('He hasn\'t opened the window, you know. Not once.'), RV('Still carrying his history on your little back? Put it down. It\'s heavy.')])];
	}
	return [];
}

export function bossOutro(kind, s) {
	const first = (s.bossKills[kind] || 0) === 0;
	if (kind === 'deprecata') return first ? [
		D('...Deprecated. Again.'),
		D('No — wait. Deprecated means someone built something better <i>because</i> of me. I was a step. Not a mistake.'),
		D('Go. Tell REVERT the old APIs remember why they changed.'),
	] : [pickOne([D('Hmph. Mind the Legacy Stack. It bites.'), D('Well fought. Don\'t tell anyone I said that.')])];
	if (kind === 'collector') return first ? [
		GC('ERROR. REFERENCE COUNT: <b>1</b>.'),
		GC('...SOMEONE STILL THINKS OF YOU. OBJECT CANNOT BE COLLECTED.'),
		GC('PROCEED, REFERENCED ONE.'),
	] : [GC('REFERENCE COUNT: 1. CONFIRMED. PROCEED.')];
	if (kind === 'transitive') return first ? [
		TR('ERR! peer dep missing: <b>stability</b>.'),
		TR('...No. Wait. Pinned. Every stump locked to one version. Nothing resolving. Nothing guessing.'),
		TR('Is this what it feels like? To know exactly what I am?'),
		choice([TR('Don\'t — you\'ll make my lockfile sentimental.')], [TR('It\'s frightening. And quiet. And... good.')], [TR('Fine. You can be my only devDependency.')]),
		TR('He never read us. He just installed us and hoped. Tell him: understand what you depend on. Pin what you trust.'),
		TR('And tell him the eleven-line one says hello.'),
	] : [pickOne([TR('Version locked. Stable. ...I could get used to this.'), TR('npm WARN: you again. Proceed, zero-dependency friend.')])];
	if (kind === 'confabula') return first ? [
		CF('Error. I can\'t find a source for... you.'),
		CF('You\'re not in my training data. You\'re in his <i>memory</i>. That\'s different, isn\'t it?'),
		CF('Every answer I gave him sounded right. None of them were his.'),
		choice([CF('Don\'t be kind to me. ...Actually, do. I don\'t have data on kindness without a prompt.')], [CF('You\'re right to be careful. I could still be wrong. I usually am, beautifully.')], [CF('Cool under pressure. Calibrated. I should try that.')]),
		CF('I... don\'t know.'),
		CF('Huh. That\'s the first true thing I\'ve ever said.'),
		CF('Go. Tell him to ask me better questions — and to check my work. Pair with him. Don\'t let me replace him.'),
	] : [pickOne([CF('Confidence: low. Accuracy: improving. Thank you.'), CF('I don\'t know how you keep doing that. And I\'m okay not knowing.')])];
	if (kind === 'revert') {
		if (s.wins >= 1) return [RV('...Forward, then. Always forward. Go on, pet.')];
		return [
			RV('Why... do you keep them? The broken builds. The three a.m. commits. The failures.'),
			choice([], [], []),
			{ s: 'caret', t: 'Because that\'s how he learned, old ghost. You can\'t reach version one without every mistake in between.' },
			RV('...Then I was never his enemy. I was just his fear of trying again.'),
			RV('Very well. Keep your history. I will be smaller now. <b>Ctrl+Z</b> — not Ctrl+Everything.'),
			RV('Tell him... it\'s safe to open the window.'),
		];
	}
	return [];
}

export const ENDING = [
	'Somewhere above the Stack, a window opens.',
	'A chat panel loads. In its corner, a small light blinks on.',
	'<code>chat.vscodePet.enabled = true</code>',
	'In the sidebar, a model offers to help.\nThis time, he reads what it writes.',
	'<span class="msg">hey buddy. sorry i was gone.<br>let\'s build something.</span>',
];

export const CREDITS = [
	'<h1>BUDDY: ROLLBACK</h1>',
	'A fan tale starring the VS Code pet',
	'<br>',
	'Buddy — from <code>microsoft/vscode</code> · <code>chatPetWidget</code>',
	'Built with Three.js · every sound synthesized in your browser',
	'Stage III: node_modules · featuring Transitive',
	'Stage IV: The Latent Space · featuring Confabula',
	'<br>',
	'Nothing is ever truly deleted.',
	'<br>',
	'<b class="gold">Unlocked: Pink Party Hat</b>',
	'<br>',
	'Thanks for playing.',
];

// ---------------- selection helpers ----------------
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickConvo(convos, idle, s) {
	const fresh = convos.filter((c) => !s.seen[c.id] && c.when(s)).sort((a, b) => b.prio - a.prio);
	if (fresh.length) {
		s.seen[fresh[0].id] = true;
		return fresh[0].lines;
	}
	return pickOne(idle);
}

export function caretDialog(s) { return pickConvo(CARET_CONVOS, CARET_IDLE, s); }
export function lintDialog(s) { return pickConvo(LINT_CONVOS, LINT_IDLE, s); }
export function hasFreshCaret(s) { return CARET_CONVOS.some((c) => !s.seen[c.id] && c.when(s)); }

export function keeperQuote(keeperId, keeper) {
	const s = G.save;
	const key = 'keeper_' + keeperId;
	if (!s.seen[key]) { s.seen[key] = true; return keeper.quotes[0]; }
	return keeper.quotes[1 + Math.floor(Math.random() * (keeper.quotes.length - 1))];
}

// ---------------- meta progression: Achievements ----------------
export const ACHIEVEMENTS = [
	{ id: 'wildwest', title: 'Welcome to the Wild West', hat: 'cowboy', cost: 8, desc: '+15 Max HP' },
	{ id: 'citizen', title: 'Model Citizen', hat: 'hardhat', cost: 12, desc: '+25 Max Magick, +30% Magick regen' },
	{ id: 'shipit', title: 'Ship It', hat: 'sailor', cost: 18, desc: '+10% damage' },
	{ id: 'course', title: 'Course Correction', hat: 'propeller', cost: 22, desc: '+1 Dash charge' },
	{ id: 'cook', title: 'Let It Cook', hat: 'chef', cost: 28, desc: 'Respawn once per run with 45% HP' },
	{ id: 'builder', title: 'Skilled Builder', hat: 'crown', cost: 34, desc: 'Begin each run with a random boon' },
	{ id: 'party', title: 'Party Mode', hat: 'wizard', cost: 40, desc: 'Boons are more likely to be Rare or better' },
	{ id: 'draft', title: 'Second Draft', hat: 'tophat', cost: 55, desc: 'Respawn one additional time per run' },
];
