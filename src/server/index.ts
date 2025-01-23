type Env = {
  DB: D1Database;
  VECTORIZE: Vectorize;
  ai: Ai;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/abstracts" && request.method === "POST") {
      const { text } = await request.json<{ text: string }>();
      if (!text) {
        return new Response("Missing text", { status: 400 });
      }

      const { results } = await env.DB.prepare(
        "INSERT INTO notes (text) VALUES (?) RETURNING *"
      )
        .bind(text)
        .run();

      const record = results.length ? results[0] : null;

      if (!record) {
        return new Response("Failed to create note", { status: 500 });
      }

      const { data } = await env.ai.run("@cf/baai/bge-base-en-v1.5", {
        text: [text],
      });
      const values = data[0];

      if (!values) {
        return new Response("Failed to generate vector embedding", {
          status: 500,
        });
      }

      const { id } = record as { id: number };
      const inserted = await env.VECTORIZE.upsert([
        {
          id: id.toString(),
          values,
        },
      ]);

      return new Response(JSON.stringify({ id, text, inserted }));
    }

    if (path === "/abstracts" && request.method === "GET") {
      const question =
        url.searchParams.get("text") || "What is the square root of 9?";

      const embeddings = await env.ai.run("@cf/baai/bge-base-en-v1.5", {
        text: [question],
      });
      const vectors = embeddings.data[0];

      const vectorQuery = await env.VECTORIZE.query(vectors, { topK: 1 });
      let vectorIds;
      if (vectorQuery.matches && vectorQuery.matches.length > 0) {
        vectorIds = vectorQuery.matches.map((match) => match.id);
      } else {
        console.log("No matching vector found or vectorQuery.matches is empty");
      }

      let notes: string[] = [];
      if (vectorIds) {
        const query = `SELECT * FROM notes WHERE id IN (${vectorIds.join(
          ","
        )})`;
        // @ts-ignore
        const { results } = (await env.DB.prepare(query).all()) as {
          text: string;
        }[];
        if (results) notes = results.map((vec: { text: string }) => vec.text);
      }

      return Response.json({ notes });

      // const contextMessage = notes.length
      //   ? `Context:\n${notes.map((note) => `- ${note}`).join("\n")}`
      //   : "";

      // const systemPrompt = `When answering the question or responding, use the context provided, if it is provided and relevant.`;

      // // @ts-ignore
      // const { response: answer } = await env.ai.run(
      //   "@cf/meta/llama-3-8b-instruct",
      //   {
      //     messages: [
      //       ...(notes.length
      //         ? [{ role: "system", content: contextMessage }]
      //         : []),
      //       { role: "system", content: systemPrompt },
      //       { role: "user", content: question },
      //     ],
      //   }
      // );

      // return new Response(answer);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
