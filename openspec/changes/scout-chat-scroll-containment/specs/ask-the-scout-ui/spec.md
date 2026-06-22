## ADDED Requirements

### Requirement: Chat panel is height-bounded and scrolls internally
The conversation panel SHALL have a bounded height so that its message list scrolls within the panel rather than growing the page. Lengthening the conversation SHALL NOT change the panel's size or shift the surrounding layout (pitch, breakdown, alerts).

#### Scenario: Conversation grows past the panel
- **WHEN** the chat accumulates more messages than fit in the panel
- **THEN** the message list scrolls inside the panel and the panel's outer size is unchanged, leaving the pitch and the panels below it in place

#### Scenario: Latest reply stays in view
- **WHEN** a new message is added or a reply streams in
- **THEN** the panel's message list auto-scrolls to keep the latest content visible (the page itself does not scroll for this)

#### Scenario: Matches the pitch exactly on large screens
- **WHEN** the layout is at the large (two-column) breakpoint
- **THEN** the panel's height matches the pitch's height exactly (its bottom edge aligns with the pitch) and the chat content cannot stretch the row taller than the pitch
