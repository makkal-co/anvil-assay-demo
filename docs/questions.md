# Twenty questions a production test-data specification does not answer

Every request we see for test-data collection is clear about the dashboard it wants and quiet about
the data underneath it. These are the questions we end up asking anyway, usually after the first
dashboard shows a number nobody believes.

They are worth reading even if you never talk to us. Most of them change the design.

---

## Identity: what a result belongs to

<a id="1"></a>
**1. What identifies a unit, and when does it get that identity?**
A serial number printed at final assembly is no use for a board tested at ICT an hour earlier. If
the board has its own serial, how is it linked to the assembly it ends up in?
*Changes: whether traceability starts at the first test or the last one.*

<a id="2"></a>
**2. When a unit is retested, is that a new run or a continuation of the old one?**
Final yield and first-pass yield come out of the same records only if every attempt is kept and
numbered. Overwriting a failed run with the passing one is the most common reason a factory's
reported yield is wrong.
*Changes: how yield is calculated, and whether the true figure is recoverable at all.*

<a id="3"></a>
**3. What happens to a run that is aborted, crashes, or is stopped by the operator?**
It is neither a pass nor a fail. Discarding it hides fixture and software problems. Counting it as a
fail punishes the product for the tester's fault.
*Changes: the status model, and what the yield charts are allowed to count.*

<a id="4"></a>
**4. Is a repaired unit the same unit?**
After rework it comes back to test with the same serial. Its history should show the failure, the
repair and the retest as one story, and the repaired units should be visible as a group.
*Changes: the genealogy model, and whether repair data joins test data.*

## Software and instruments

<a id="5"></a>
**5. Which software version produced this result, and how do you know?**
The sequence's name is not enough. A version number that a developer forgot to increment is worse
than none. A source-control hash recorded automatically by the collector is the only reliable answer.
*Changes: whether a containment query ("every unit tested by v2.3") is possible.*

<a id="6"></a>
**6. What happens when a station runs a sequence version that has not been released?**
It happens: a fix is tried on one station and never reverted. Does the system refuse to record,
record and flag, or not notice?
*Changes: the release process, and whether the registry is advisory or enforced.*

<a id="7"></a>
**7. Are instrument identities and calibration dates part of every result?**
If a meter is found out of calibration, which units did it measure since its last good calibration?
Without the instrument on the record, the answer is "all of them".
*Changes: what the collector reads from the station, and the size of every recall.*

<a id="8"></a>
**8. Who owns the limits — the sequence, a limits file, or a database?**
Limits copied into five sequences drift apart. Limits held centrally need a change process. Either
way, every result must store the limits it was judged against at the time.
*Changes: where limits live, and whether old results can be re-judged against new limits.*

## Collection and the network

<a id="9"></a>
**9. What does a tester do when the server is unreachable?**
It must still test, and still keep every result. How much local storage is enough, and who is told
when a queue is filling?
*Changes: collector design, local disk sizing, and whether IT maintenance stops production.*

<a id="10"></a>
**10. Which testers can never be networked, and how does their data arrive?**
Some areas are isolated by policy. A signed export to removable media, imported centrally, is a
legitimate collection path, and it should be designed for, not improvised.
*Changes: the air-gap path, and the audit trail around it.*

<a id="11"></a>
**11. Whose clock is right?**
Stations with drifting clocks make a sequence of events impossible to reconstruct across a line.
Are station clocks synchronised, and is the time recorded in UTC?
*Changes: time sync on the shop floor, and whether cross-station analysis is trustworthy.*

<a id="12"></a>
**12. What do legacy and vendor testers actually write, and can it be changed?**
An in-circuit tester's log format is whatever its vendor decided. A file watcher can parse it, but
only if the format is known and stable, and the unit serial is in it.
*Changes: how much parsing work is needed, and which testers join the data on day one.*

## Data and what survives

<a id="13"></a>
**13. Are waveforms and raw files part of the record, or only the extracted numbers?**
A pass/fail and a value are cheap to store. A captured waveform is what explains a field failure two
years later. Keep files as files, referenced from the record, not inside database rows.
*Changes: storage design, and what an investigation can see.*

<a id="14"></a>
**14. How long is each product's data kept, and who may delete it?**
Defence and medical products may need records for decades. Consumer products may not. A retention
policy per product is a design feature, not a script someone runs.
*Changes: storage sizing, and whether evidence can disappear quietly.*

<a id="15"></a>
**15. Which products' data is restricted, and from whom?**
Export-controlled or customer-confidential programmes may need to be invisible to people who can
see the rest of the factory.
*Changes: roles, data classification, and whether one store can serve every product.*

## Analysis and decisions

<a id="16"></a>
**16. Which decision does each dashboard serve, and who makes it?**
A panel nobody acts on is noise. Naming the decision first decides the time window, the refresh
rate and who gets alerted.
*Changes: which dashboards are built first, and which are never built.*

<a id="17"></a>
**17. Is a measurement judged only against its limits, or also against its own trend?**
A value drifting towards a limit across a week of production is a fixture or an instrument wearing
out. A limit only catches it after the yield has dropped.
*Changes: whether SPC and drift alerts are part of the system or an afterthought.*

<a id="18"></a>
**18. How are stations compared when they measure the same thing?**
Two stations disagreeing by a small offset is invisible on each one's own pass/fail. Side by side,
it is a calibration problem with a date on it.
*Changes: station correlation views, and golden-unit routines.*

<a id="19"></a>
**19. Is there a golden unit, and is it tested on a schedule?**
A known unit, tested every shift on every station, is the cheapest drift detector there is, but its
results must be recorded and kept out of the production yield.
*Changes: the status model, and how station health is proven.*

<a id="20"></a>
**20. Where do business and design teams get their data — from dashboards or from the store?**
Power BI, Excel and analysis notebooks each want different shapes. Published views or extracts stop
every team from writing its own fragile queries.
*Changes: the export layer, and who maintains the queries.*

---

*If your answers to several of these are "it depends" or "we've never decided", that is normal, and
it is exactly the conversation we start with: **support@makkal.co**.*
