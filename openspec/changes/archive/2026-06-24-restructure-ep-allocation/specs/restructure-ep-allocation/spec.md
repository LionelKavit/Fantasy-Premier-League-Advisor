## ADDED Requirements

### Requirement: Restructure value and cost are denominated in expected points
A restructure's net and cost SHALL both be expressed in expected points (ep), consistent with the rest of
the transfer engine, rather than mixing a composite score with a points cost.

#### Scenario: Net is computed from ep
- **WHEN** a restructure chain is evaluated (downgrade a funder, buy a cheaper replacement, buy the dream)
- **THEN** its net is `(dream.epNext − weak.epNext) + (replacement.epNext − funder.epNext)`
- **AND** the row displays the net as a points value (e.g. "net +2.3 pts") alongside the points cost

#### Scenario: Missing projection skips the chain
- **WHEN** any of the four players in a chain has no `epNext`
- **THEN** the chain is excluded (consistent with holding a transfer when ep is unavailable)

### Requirement: Restructures clear the same ep-bar gate as free transfers
A restructure SHALL be recommended only if its net ep exceeds the bar for the two transfers it spends, where
each free move contributes a 1.5-pt bar and each hit move a 4-pt bar.

#### Scenario: Two free transfers
- **WHEN** a restructure would use two free transfers
- **THEN** it is kept only if its net ep exceeds 3.0 (2 × 1.5)

#### Scenario: One free transfer remaining
- **WHEN** a restructure would use one free transfer and one hit
- **THEN** it is kept only if its net ep exceeds 5.5 (1.5 + 4)

#### Scenario: No free transfers
- **WHEN** a restructure would use two hits
- **THEN** it is kept only if its net ep exceeds 8.0 (2 × 4)

### Requirement: The free-transfer recommendation chooses the optimal mix of swaps and restructures
The engine SHALL allocate the available free transfers to the conflict-free set of moves — straight swaps
(one transfer each) and restructures (two transfers each) — that maximizes total expected points net of the
banking opportunity cost, rather than only ever replacing the weakest players.

#### Scenario: A restructure beats straight swaps
- **WHEN** a two-transfer restructure projects more ep (net of opportunity cost) than the best two straight
  swaps it would displace
- **THEN** the restructure is selected into the primary recommendation, rendered as its two transfer lines
  and counted in the "Make N free transfers" headline

#### Scenario: Straight swaps beat a restructure
- **WHEN** two straight swaps together project more surplus than any restructure for the same two transfers
- **THEN** the swaps are selected and the restructure is not

#### Scenario: Allocation respects the budget and legality
- **WHEN** the optimal set is chosen
- **THEN** total transfers used does not exceed the free-transfer count, no player is bought or sold twice,
  the running bank never goes negative, and no club exceeds three players
- **AND** transfers whose marginal surplus is negative are banked rather than spent

#### Scenario: Boundaries are preserved
- **WHEN** the free-transfer count is 0
- **THEN** no free move (swap or restructure) is selected; the move is handled as a hit as today
- **WHEN** the free-transfer count is 1
- **THEN** no restructure (which needs two transfers) is selected into the free plan

### Requirement: The Restructure section shows only non-chosen options, priced against the remaining budget
The Restructure section SHALL list only the chains not selected into the primary recommendation, and each
SHALL be gated and priced against the free transfers remaining **after** the recommended moves.

#### Scenario: A chosen restructure is not duplicated
- **WHEN** a restructure is selected into the primary Transfer plan
- **THEN** it appears in the Transfer section only, not also in the Restructure section

#### Scenario: Section cost reflects remaining free transfers
- **WHEN** the recommended moves leave one free transfer and a section restructure needs two
- **THEN** that chain is priced as one free + one hit (cost −4) and gated at 5.5, not shown as free

#### Scenario: Plenty of free transfers remain
- **WHEN** the recommended moves leave two or more free transfers
- **THEN** a section restructure is priced as free and gated at 3.0
