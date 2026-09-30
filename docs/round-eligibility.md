# Competitive round eligibility

The parser uses recorded match state and score progression. It does not classify
rounds from their duration, map, player count or weapon loadouts.

A start requires a started match outside warmup. A freeze-end event begins live
capture. A recorded result creates a candidate. The next start confirms that
candidate only when the recorded completed-round count equals its round number.
An official-end event alone does not confirm it. This allows a subsequent warmup
or restart to discard a completed knife stage before publication.

Warmup, game-commencing result reason 16, a stopped match outside final postmatch,
or a decrease in completed-round count abandons the attempt. A reset message
clears its published rounds, pending slot and selection. A valid start in the same
packet begins the replacement attempt. Recorded game phase 5 preserves the last
round's postmatch activity through the terminal packet.

[MatchZy's CS2 knife lifecycle](https://github.com/shobhit-pathak/MatchZy/blob/dev/Utility.cs)
ends warmup to run its knife stage, then returns to warmup and restarts before live
play. The generated lifecycle regression exercises that recorded transition,
followed by an abandoned live attempt and a retained competitive completion.

The supplied Dust II fixture verifies a real aborted start at tick 449 and all
23 competitive completions. It contains no knife stage. There is no universal
knife flag established by this implementation. A standalone knife recording with
no recorded warmup or restart is indistinguishable from competitive play under
this policy and remains a compatibility limitation.
