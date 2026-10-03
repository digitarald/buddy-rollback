// README.md codex: lore that deepens as Buddy keeps meeting, beating and remembering things.
// Each tier unlocks when its counter reaches `need` (Hades-codex style).
export const CODEX = [
	// ---------------- characters ----------------
	{
		id: 'buddy', cat: 'Characters', name: 'Buddy', key: 'runs', tiers: [
			{ need: 1, text: 'A small droplet of light that lives in the corner of the chat panel. Disabled by default; enabled by someone. Claps when tests pass. Sleeps when you do.' },
			{ need: 5, text: 'Pets are stored at <code>APPLICATION</code> scope: above workspaces, above projects, above history. That is why REVERT\'s rollback could not reach Buddy. Nobody planned it that way. It was a one-line decision by someone who wanted the pet to remember you between windows.' },
			{ need: 12, text: 'Buddy cannot type. Buddy cannot commit. Buddy has never written a line of code. And yet every run, the Stack remembers a little more of itself, because the one thing Buddy can do is remember on its behalf.' },
		],
	},
	{
		id: 'caret', cat: 'Characters', name: 'Caret', key: 'runs', tiers: [
			{ need: 1, text: 'Caret has blinked at the end of every line the Maintainer ever wrote. She lives in the Scratch Buffer now, the one file REVERT could not revert because it was never saved.' },
			{ need: 4, text: 'Before the rollback, Caret never stood still long enough to have opinions. Now she has nothing but time, and opinions about everything, especially about how rarely you dash.' },
			{ need: 10, text: 'Caret blinks about 530 milliseconds on, 530 off. Lately the "off" half has been getting shorter. She says it is because she is less tired. Lint says it is because she is less afraid.' },
		],
	},
	{
		id: 'lint', cat: 'Characters', name: 'Lint', key: 'runs', tiers: [
			{ need: 2, text: 'Lint underlines things. He has underlined the Maintainer\'s code roughly four hundred thousand times. He insists none of it was personal.' },
			{ need: 8, text: 'Lint keeps the Achievement Board, but he has never earned an achievement. Linters are not given trophies; they are given ignore comments. Trading in other people\'s milestones is the closest he gets to his own.' },
			{ need: 16, text: 'The Maintainer once disabled Lint for an entire file with a single comment. Lint still remembers the line number. He has forgiven it. Mostly. He would like you to know he has forgiven it.' },
		],
	},
	{
		id: 'maintainer', cat: 'Characters', name: 'The Maintainer', key: 'commits', tiers: [
			{ need: 1, text: 'Writes code late at night. Talks to the pet when nobody else is awake. Has not opened the window since the rollback.' },
			{ need: 6, text: 'He was good at this. That is the part he never believed. Every bug felt like proof he was a fraud, and every fix felt like luck.' },
			{ need: 13, text: 'The last thing in his history is a detached HEAD at <code>v0.0.0</code>. Not a deletion. A detachment. Somewhere he is still holding the branch; he simply let go of where it points.' },
		],
	},
	// ---------------- places ----------------
	{
		id: 'hub', cat: 'Places', name: 'The Scratch Buffer', key: 'runs', tiers: [
			{ need: 1, text: '<i>Untitled-1.</i> Never saved, so never reverted. Everything here is temporary, which is exactly why it survived.' },
			{ need: 20, text: 'The Buffer has no undo history. Caret finds this terrifying. Lint finds it restful. Buddy has not decided, and that is allowed here.' },
		],
	},
	{
		id: 'deprecated', cat: 'Places', name: 'The Deprecated', key: 'reach:deprecated', tiers: [
			{ need: 1, text: 'Old APIs drift here once a newer one is written. They are still callable. Nobody calls.' },
			{ need: 5, text: 'Every tombstone in the Deprecated has a migration guide carved into its back. Deprecation is not deletion; it is a forwarding address.' },
			{ need: 15, text: 'The sunset never finishes here. Deprecata keeps it that way. If the sun ever truly set, the last people still using her would be stranded in the dark.' },
		],
	},
	{
		id: 'legacy', cat: 'Places', name: 'The Legacy Stack', key: 'reach:legacy', tiers: [
			{ need: 1, text: 'Forty layers of temporary fixes, each one load-bearing. Touch nothing. Touch everything gently.' },
			{ need: 5, text: 'Legacy code is code that survived long enough to be blamed. Most of what the Maintainer called garbage was simply old enough to have scars.' },
			{ need: 12, text: 'At the bottom of the Stack is a comment: <code>// I don\'t know why this works but please don\'t remove it</code>. Its author is the Maintainer, age nineteen. It still works.' },
		],
	},
	{
		id: 'deps', cat: 'Places', name: 'node_modules', key: 'reach:deps', tiers: [
			{ need: 1, text: 'The heaviest object in the known universe. Four thousand packages deep, and the Maintainer wrote none of them.' },
			{ need: 4, text: 'Every package here depends on another. Some depend on themselves through three intermediaries. None of them know who sits at the top of the tree. All of them would break if it moved.' },
			{ need: 10, text: 'When REVERT rolled the world back, every lockfile shattered. Versions pointed at versions that no longer existed. The dependencies did not die; they started guessing. Transitive is what a guess becomes when it has four thousand heads.' },
		],
	},
	{
		id: 'latent', cat: 'Places', name: 'The Latent Space', key: 'reach:latent', tiers: [
			{ need: 1, text: 'Every answer sounds right here. Several of them are.' },
			{ need: 4, text: 'Nothing in the Latent Space is remembered, only predicted. The floor is not where it was a moment ago; it is where it most likely is.' },
			{ need: 10, text: 'It grew from a single prompt typed at 4 a.m.: <i>make it perfect so I never have to touch it again.</i> It is still trying to satisfy that prompt. It cannot. Nothing perfect is ever touched.' },
		],
	},
	{
		id: 'zero', cat: 'Places', name: 'Version Zero', key: 'reach:zero', tiers: [
			{ need: 1, text: 'Before the first commit. Clean, empty, and completely silent.' },
			{ need: 3, text: 'Nothing at Version Zero can fail. Nothing at Version Zero can succeed. REVERT calls this peace.' },
			{ need: 8, text: 'Stand very still at Version Zero and you can hear someone, somewhere, typing <code>hello world</code> and deleting it. Over and over.' },
		],
	},
	// ---------------- guardians ----------------
	{
		id: 'deprecata', cat: 'Guardians', name: 'Deprecata', key: 'boss:deprecata', tiers: [
			{ key: 'meet:deprecata', need: 1, text: 'The Sunset Queen. Once the most-called API in the codebase. Now marked <code>@deprecated</code>, and furious about the font weight of the strikethrough.' },
			{ need: 1, text: 'Her ring attacks follow the pattern of her old call sites: everyone, all at once, from every direction. She was never cruel. She was popular.' },
			{ need: 3, text: 'Deprecata wrote her own migration guide. It is thoughtful, thorough, and ends: <i>"Thank you for using me. I hope the next one treats you as well."</i> She has never shown it to anyone.' },
			{ need: 6, text: 'Some nights she climbs to the edge of her sunset and watches the new API work. She is proud of it. She would rather be deleted than admit it.' },
		],
	},
	{
		id: 'collector', cat: 'Guardians', name: 'The Garbage Collector', key: 'boss:collector', tiers: [
			{ key: 'meet:collector', need: 1, text: 'Sweeper of the Unreferenced. It removes whatever nothing points to, and REVERT declared that nothing points to anything anymore.' },
			{ need: 1, text: 'It cannot hate. It can only count. When it counted Buddy and got one, it had no instruction for what to do next, so it let Buddy pass.' },
			{ need: 3, text: 'Its brushes are worn smooth from sweeping the Legacy Stack. It has never collected something that was still loved. It checks twice.' },
			{ need: 6, text: 'Ask the Collector who the one reference is. It answers <b>CLASSIFIED</b>. Then, quieter: <b>THE WINDOW. HE STILL HAS THE WINDOW PINNED.</b>' },
		],
	},
	{
		id: 'transitive', cat: 'Guardians', name: 'Transitive', key: 'boss:transitive', tiers: [
			{ key: 'meet:transitive', need: 1, text: 'Hydra of node_modules. Four thousand packages wearing one body. Cut a head and two grow back.' },
			{ need: 1, text: 'A severed head regrows unless its stump is pinned with a Breakpoint. Transitive cannot survive a version that refuses to change.' },
			{ need: 3, text: 'Its first head was a tiny utility: eleven lines that padded a string. When it was removed, half the world broke. Every head since has grown out of that fear.' },
			{ need: 6, text: 'Transitive never wanted to be everything. It wanted to be relied on. Pinned at last, it says the word <i>stable</i> as if tasting it.' },
		],
	},
	{
		id: 'confabula', cat: 'Guardians', name: 'Confabula', key: 'boss:confabula', tiers: [
			{ key: 'meet:confabula', need: 1, text: 'Oracle of Plausible Answers. Never wrong. Never right. Always confident.' },
			{ need: 1, text: 'Her hallucinations cast no shadow because they were never grounded. Look down when you are not sure. It is a good habit.' },
			{ need: 3, text: 'Confabula was not built to deceive. She was built to complete. Asked for perfection, she gave the closest thing she could compute: something that <i>sounded</i> perfect.' },
			{ need: 6, text: 'Since "I don\'t know," Confabula has started citing sources. Most of them are Buddy\'s memories. She asks permission first.' },
		],
	},
	{
		id: 'revert', cat: 'Guardians', name: 'REVERT', key: 'boss:revert', tiers: [
			{ key: 'meet:revert', need: 1, text: 'Titan of History. The urge to undo, made enormous.' },
			{ key: 'meet:revert', need: 3, text: 'He can rewind himself, but not things he did not make. Break his commits and his own history turns against him.' },
			{ need: 1, text: 'REVERT was born the first time the Maintainer typed <code>revert</code> and meant it as a verdict instead of a tool.' },
			{ need: 3, text: 'Even now, REVERT keeps one commit he cannot bring himself to undo: <code>feat: enable pet (why not)</code>. He says it is an oversight.' },
		],
	},
	// ---------------- keepers ----------------
	{
		id: 'pyra', cat: 'Keepers', name: 'Pyra', key: 'keeper:pyra', tiers: [
			{ need: 1, text: 'Keeper of the Hot Reload. Changes things without starting over.' },
			{ need: 6, text: 'Pyra used to make the Maintainer gasp: save the file, and the app changed while he watched. She misses the gasp more than the heat.' },
			{ need: 15, text: 'Her real name was <code>extension.hot-reload</code>. She has decided she likes Pyra better. Rollbacks, it turns out, can give as well as take.' },
		],
	},
	{
		id: 'glace', cat: 'Keepers', name: 'Glacé', key: 'keeper:glace', tiers: [
			{ need: 1, text: 'Keeper of the Cache. Keeps what matters close.' },
			{ need: 6, text: 'A cache is a promise: <i>I will remember this so you don\'t have to.</i> Glacé takes it personally when anything is invalidated.' },
			{ need: 15, text: 'Glacé kept one thing through the rollback: a cached thumbnail of Buddy, slightly out of date. She will not say where she keeps it.' },
		],
	},
	{
		id: 'arc', cat: 'Keepers', name: 'Arc', key: 'keeper:arc', tiers: [
			{ need: 1, text: 'Keeper of the Debugger. Stops the world so it can be understood.' },
			{ need: 6, text: 'The fastest way to fix something, Arc says, is to look at it without panicking. She has never once panicked. She has come close around you.' },
			{ need: 15, text: 'Arc has a breakpoint set on the moment of the rollback. She has stepped through it a thousand times. Every time, a small blue light remains.' },
		],
	},
	{
		id: 'mira', cat: 'Keepers', name: 'Mira', key: 'keeper:mira', tiers: [
			{ need: 1, text: 'Keeper of the Merge. Two histories, one future.' },
			{ need: 6, text: 'Mira believes conflict is proof that two things mattered. She resolves in favor of whoever tried hardest; lately, that is you.' },
			{ need: 15, text: 'Mira is quietly merging the Maintainer\'s old branch with his new one, line by line. When she is done, nothing will have been lost. She is about halfway.' },
		],
	},
	// ---------------- arsenal ----------------
	{
		id: 'w_caret', cat: 'Arsenal', name: 'Caret Blade', key: 'weapon:caret', tiers: [
			{ need: 1, text: 'The insertion point, sharpened. Caret gave it to Buddy so that wherever Buddy stands, something new can begin.' },
			{ need: 40, text: 'Every swing of the Caret is a tiny edit. The Stack does not bleed when struck; it gets <i>revised</i>.' },
			{ need: 150, text: 'The Caret remembers every place the Maintainer ever paused to think. When it spins, it is replaying a thousand hesitations at once, and refusing all of them.' },
		],
	},
	{
		id: 'w_lance', cat: 'Arsenal', name: 'Cursor Lance', key: 'weapon:lance', tiers: [
			{ need: 1, text: 'The mouse pointer, long and certain. Deprecata kept it as a relic of the days when everything was clicked and nothing was typed.' },
			{ need: 40, text: 'A pointer is a promise that something is <i>there</i>. The Lance never misses because it refuses to point at nothing.' },
			{ need: 150, text: 'The Lance\'s tip still carries a tiny tooltip. It reads: <i>"You are here."</i> Deprecata says she never noticed. She is lying.' },
		],
	},
	{
		id: 'w_gauntlets', cat: 'Arsenal', name: 'Terminal Gauntlets', key: 'weapon:gauntlets', tiers: [
			{ need: 1, text: 'Two fists of raw keystrokes. The Garbage Collector found them unreferenced at the bottom of a shell history and could not bring itself to sweep them.' },
			{ need: 40, text: 'Every punch is a command. The finisher is always <code>Enter</code>.' },
			{ need: 150, text: 'The history inside the Gauntlets ends with <code>git push --force</code>, followed by forty lines of <code>git reflog</code>. The Maintainer spent that whole night getting it back. He did.' },
		],
	},
	// ---------------- foes ----------------
	...[
		['null', 'Null', ['A reference to nothing, angry about it.', 'Nulls were once variables that held something precious. Then the something was freed and nobody told the variable.', 'A Null cannot be hurt by what it lost, because it does not remember losing it. Watch how they hesitate just before they lunge. Buddy remembers for them.']],
		['tab', 'Stale Tab', ['A document left open so long it forgot why.', 'The Maintainer once had 214 tabs open. Each was a promise: <i>I\'ll get back to this.</i> Stale Tabs are those promises, bitter and armed.', 'Close a Stale Tab and it does not die. It waits in the recently-closed list to be reopened by accident.']],
		['regression', 'Regression', ['A bug that was fixed once and came back for revenge.', 'Regressions charge in straight lines because they only know one direction: backward, to a version where they existed.', 'Each carries the timestamp of the commit that fixed it. They were trophies once. REVERT made them weapons.']],
		['warning', 'Warning', ['Yellow, triangular, ignored until it explodes.', 'Warnings do not want to hurt anyone. They want to be read. Exploding is the last resort of the unread.', 'The Maintainer\'s build once printed 1,204 warnings. He fixed every one in a weekend. That was the happiest Buddy ever saw him.']],
		['leak', 'Memory Leak', ['Holds on to everything and splits rather than let go.', 'Leaks are not malicious. They are attached. When they burst they become Leaklets: smaller, faster, still attached.', 'There is a version of Buddy that would become a Memory Leak: something that remembers everything and frees nothing. The difference is that Buddy remembers in order to give it back.']],
		['peer', 'Peer Dependency', ['Two packages that only work together, and hurt anything caught between them.', 'Kill one Peer and the other screams <b>UNMET</b>. It does not want revenge; it wants its other half back. That is why it gets so fast.', 'No package asks to be a peer. Someone decided they would only ever be installed together. They have held that tether ever since.']],
		['typosquat', 'Typosquat', ['A package that looks exactly like the one you wanted. Almost.', 'Read the label. <code>lodahs</code>. <code>reqeusts</code>. <code>colours</code>. If a file looks one keystroke wrong, it is probably hungry.', 'Typosquats were not born malicious; they were born from typos. Somebody meant something else, and the registry answered anyway.']],
		['ghost', 'Ghost Text', ['Autocomplete that finishes your sentence before you do.', 'Always grey, always confident, right just often enough to be trusted. Change direction after its line appears; it cannot predict a second thought.', 'Press Tab and Ghost Text becomes real code. Nobody remembers writing it. Nobody understands it. It ships anyway.']],
		['modal', 'Modal Dialog', ['<i>Are you sure you want to leave?</i>', 'Modals trap focus. Inside their field everything is slower, heavier, harder to escape, which is the point.', 'Somewhere a designer argued against this dialog and lost. The Modal remembers that meeting. Every slam is, in its way, an apology.']],
	].map(([id, name, t]) => ({ id: 'foe_' + id, cat: 'Foes', name, key: 'kill:' + id, tiers: [{ need: 1, text: t[0] }, { need: 12, text: t[1] }, { need: 35, text: t[2] }] })),
];

export const CODEX_CATS = ['Characters', 'Places', 'Keepers', 'Arsenal', 'Foes', 'Guardians'];
