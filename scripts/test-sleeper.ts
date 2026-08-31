import { config } from "dotenv";
config({ path: ".env.local" });
import { sleeper } from "../lib/sleeper/client";
import { resolveLeagueChain } from "../lib/sleeper/chain";

async function main() {
  const currentLeagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!currentLeagueId) throw new Error("SLEEPER_LEAGUE_ID not set");

  console.log("Resolving dynasty league chain...");
  const chain = await resolveLeagueChain(currentLeagueId);
  console.log(
    chain.map((l) => `${l.season}: ${l.name} (${l.league_id}) [${l.status}]`)
  );

  for (const league of chain) {
    console.log(`\n=== ${league.season} (${league.league_id}) ===`);

    const users = await sleeper.getLeagueUsers(league.league_id);
    console.log(`users: ${users.length}`);

    const rosters = await sleeper.getRosters(league.league_id);
    console.log(`rosters: ${rosters.length}`);

    const drafts = await sleeper.getDrafts(league.league_id);
    console.log(`drafts: ${drafts.length}`);
    let pickCount = 0;
    for (const d of drafts) {
      const picks = await sleeper.getDraftPicks(d.draft_id);
      pickCount += picks.length;
    }
    console.log(`draft picks: ${pickCount}`);

    const tradedPicks = await sleeper.getTradedPicks(league.league_id);
    console.log(`traded picks: ${tradedPicks.length}`);

    let matchupWeeks = 0;
    let matchupRows = 0;
    for (let week = 1; week <= 18; week++) {
      const m = await sleeper.getMatchups(league.league_id, week);
      if (m && m.length > 0) {
        matchupWeeks++;
        matchupRows += m.length;
      }
    }
    console.log(`matchup weeks with data: ${matchupWeeks}, total rows: ${matchupRows}`);

    let txCount = 0;
    for (let week = 0; week <= 18; week++) {
      const tx = await sleeper.getTransactions(league.league_id, week);
      if (tx) txCount += tx.length;
    }
    console.log(`transactions: ${txCount}`);

    if (league.status === "complete") {
      const winners = await sleeper.getWinnersBracket(league.league_id);
      console.log(
        `winners bracket matches: ${winners.length}, champion match:`,
        winners.find((m) => m.p === 1)
      );
    }
  }

  console.log("\nFetching full player dictionary (this is the big one, ~14MB)...");
  const players = await sleeper.getAllPlayers();
  console.log(`total NFL players in Sleeper DB: ${Object.keys(players).length}`);

  console.log("\nAll Sleeper endpoints reachable and returning expected shapes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
