const http = require('http');

async function run() {
  const qList = ["Benchmark", "arsitektur", "halo"];
  
  console.log("\n[SEARCH BENCHMARK]\n");
  console.log("Query         Mode            Run1   Run2   Run3   Median   TotalMs   Results");
  console.log("-------------------------------------------------------------------------------");

  for (const q of qList) {
    const res = await fetch(`http://localhost:3012/api/v1/conversations/benchmark?q=${q}`);
    const data = await res.json();
    
    if (data.error) {
      console.log(`${q.padEnd(13)} ERROR: ${data.error}`);
      continue;
    }
    
    console.log(
      `${data.query.padEnd(13)} ` +
      `${data.mode.padEnd(15)} ` +
      `${String(data.runs[0]).padEnd(6)} ` +
      `${String(data.runs[1]).padEnd(6)} ` +
      `${String(data.runs[2]).padEnd(6)} ` +
      `${String(data.medianQueryMs + " ms").padEnd(8)} ` +
      `${String(data.totalMs + " ms").padEnd(9)} ` +
      `${data.resultsCount}`
    );
  }
  console.log("\n");
}
run();
