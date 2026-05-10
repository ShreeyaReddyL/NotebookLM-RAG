async function run() {
  try {
    const url = "https://43c8e937-9029-45ba-b73f-eb7440a52c13.eu-central-1-0.aws.cloud.qdrant.io";
    const res = await fetch(url);
    console.log("SUCCESS:", res.status);
  } catch(e) {
    console.error("FETCH ERROR:", e.message, e.code);
  }
}
run();
