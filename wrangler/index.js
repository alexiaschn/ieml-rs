const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(req, env) {
    
    const url = new URL(req.url);

    if (url.pathname === "/secrets") {
      return new Response(
        JSON.stringify({ keyDefined: !!env.TOGETHER_API_KEY }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // OPTIONS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- GET /getKeywords ---
    if (url.pathname === "/getKeywords" && req.method === "GET") {
      try {
        const object = await env.MY_BUCKET.get("data.csv");
        const text = object ? await object.text() : "";

        return new Response(JSON.stringify(parseCSV(text)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }
    if (url.pathname === "/saveKeyword" && req.method === "POST") {
      try {
        // 1. Parse JSON body
        const newRow = await req.json();
    
        // 2. Read CSV from bucket
        const object = await env.MY_BUCKET.get("data.csv");
        const existing = object ? await object.text() : "";
    
        // 3. Prepare updated CSV
        const header = "mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment";
        const fields = ["mot","theme","qui","quoi","a_qui","par_quoi","quand","ou","pourquoi","comment"];
    
        let updatedCSV = existing.trim() ? existing + "\n" : header + "\n";
        updatedCSV += fields.map(f => newRow[f] ?? "").join(",");
    
        // console.log("updatedCSV to save:", updatedCSV);
    
        // 4. Save back to bucket
        await env.MY_BUCKET.put("data.csv", updatedCSV, {
          httpMetadata: { contentType: "text/csv" },
        });
    
        return new Response(JSON.stringify({ success: true, row: newRow }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    
      } catch (err) {
        console.error("saveKeyword error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    // --- GET /retrieval?keyword=... ---
    if (url.pathname === "/retrieval" && req.method === "GET") {
      const keyword = url.searchParams.get("keyword");
      if (!keyword) {
        return new Response(JSON.stringify({ error: "Missing keyword parameter" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        console.log("Keyword:", keyword);
        const context = await retrieveWords(keyword, env);
        console.log("Context:", context);
        const translation = await translateKeywordToIEML(keyword, context, env);
        console.log("Translation:", translation);
        
        return new Response(JSON.stringify({ translation }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message, stack: err.stack }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    // --- GET /isidore?terms=... ---
    if (url.pathname === "/isidore" && req.method === "GET") {
      const terms = url.searchParams.get("terms");
      if (!terms) {
        return new Response(JSON.stringify({ error: "Missing terms parameter" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const apiUrl = `https://api.isidore.science/resource/search?q=${encodeURIComponent(terms)}&replies=20&output=json`;

      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: "Failed to fetch Isidore API" }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }
    // --- GET /crossref?doi=... ---
if (url.pathname === "/crossref" && req.method === "GET") {
  const doi = url.searchParams.get("doi");
  if (!doi) {
    return new Response(JSON.stringify({ error: "Missing doi parameter" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Crossref proxy error:", err);
    return new Response(JSON.stringify({ error: "Crossref fetch failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// --- POST /queryAugmentation ---
if (url.pathname === "/queryAugmentation" && req.method === "POST") {
  try {
    const body = await req.json();
    const keywords = body?.keywords;

    if (!keywords) {
      return new Response(JSON.stringify({ error: "Missing keywords in request body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!env.TOGETHER_API_KEY) {
      console.error("Missing TOGETHER_API_KEY environment variable!");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const model = "google/gemma-3n-E4B-it"; 
    const promptGenerateVariants = `Produit 10 variants de la requête booléenne suivante "${keywords}". Combine les requêtes proposées à l'aide de l'opérateur OU comme dans l'exemple : Mots-clés:  "impact of climate change on biodiversity". Réponse: "
(climate change biodiversity impact) OU (effects of climate change on ecosystems) OU (biodiversity loss due to climate change) OU (climate change species extinction) OU (impact of global warming on wildlife) OU (effects of climate change on ecosystems and species diversity) OU (how climate change impacts wildlife and biodiversity) OR (climate change consequences for biological diversity) OU (relationship between climate change and loss of biodiversity) OU (climate change threats to flora and fauna diversity) OU (impact of climate change on biodiversity)
C'est à ton tour avec "${keywords}". Répond uniquement avec la requête sans donner d'explication.`;

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.TOGETHER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: promptGenerateVariants }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Together API error:", text);
      return new Response(JSON.stringify({ error: text }), {
        status: response.status,
        headers: corsHeaders,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
// --- GET/POST /keptLogs ---
if (url.pathname === "/keptLogs" && (req.method === "GET" || req.method === "POST")) {
  try {
    // Load existing logs
    let existingLogs = [];
    const object = await env.MY_BUCKET.get("keptLogs.json");
    if (object) {
      try {
        const text = await object.text();
        existingLogs = JSON.parse(text);
      } catch {
        existingLogs = [];
      }
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { logs, userId } = body;

      if (!Array.isArray(logs)) {
        return new Response(JSON.stringify({ error: "Body must include an array 'logs'" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const id = userId || crypto.randomUUID();
      const newSession = {
        userId: id,
        timestamp: new Date().toISOString(),
        logs,
      };

      const updatedLogs = [...existingLogs, newSession];

      await env.MY_BUCKET.put("keptLogs.json", JSON.stringify(updatedLogs, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          userId: id,
          totalSessions: updatedLogs.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify(existingLogs), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });

  } catch (err) {
    console.error("Error in /keptLogs:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}



    // --- default: unknown route ---
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};

// ------------------ Utilities ------------------

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() || ""]));
  });
}

// Embed the query
async function embedQuery(keyword, env) {
  const response = await fetch("https://api.together.xyz/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "intfloat/multilingual-e5-large-instruct",
      input: keyword,
    }),
  });

  if (!response.ok) {
    console.error(await response.text());
    return null;
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}


async function retrieveWords(keyword, env) {
  const embedding = await embedQuery(keyword, env);
  if (!embedding) return [];

  const response = await supabaseFetch(
    "rpc/match_embeddings",
    {
      method: "POST",
      body: {
        query_embedding: embedding,
        match_count: 30,
        similarity_threshold: 0.1
      }
    },
    env
  );

  if (!response.ok) {
    console.error(await response.text());
    return [];
  }

  const rows = await response.json();
  return rows.map(r => r.word);
}

// supabase wrapper idk
function supabaseFetch(path, { method = "GET", headers = {}, body } = {}, env) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;

  return fetch(url, {
    method,
    headers: {
      "apikey": env.SUPABASE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}


// Translate keyword using Together AI
async function translateKeywordToIEML(keyword, context, env) {
  const prompt = `Tu es un expert en sémantique. Tu dois décomposer sémantiquement le mot-clé "${keyword}" à partir des 9 valeurs suivantes :
'thème, qui, quoi, à qui, par quoi, quand, où, pourquoi, comment'
## Exemples
pensionnat : habiter,élève,,,,,*dans école,,
compétences culturelles : compétence,,culture,,,,,,
littérature coloniale : littérature,,,,,*pendant colonialisme,,,
didactique de la lecture numérique : enseignement,,lire,,*par le moyen de technique numérique,,,,*avec méthode
romantisme : littérature,,exprimer son émotion,,imagination,,,*coloré par le sentiment poésie,
arts martiaux : ~plusieurs art martial,,,,,,,,
chanson engagée : littérature,chanteur,,,,,,engagement,poésie
création : création,,,,,,,,
réécriture : création,,écrire,,*par le moyen de processus,,,,*encore écrire
enseignement secondaire : enseignement,,,,,école secondaire,,,
malfaisance : négativité,,action,,*a pour effet mal,,,,
sororité : politique,mouvements socio-politiques,,,*en relation avec sœur,,,,*pro femme
compétence en lecture littéraire : compétence,,lire,,,,,*dans le contexte de littérature,
facteurs sociaux : société,~plusieurs variable,,,,,,,
écrit : communication,,texte,,,,,,
cinéma et littératrure : cinéma,,,,,,,,*avec littérature
épopée : voyage,lignage,,,,longuement,,,~gérondif guerroyer
méthode expérimentale : méthode,,,,*par le moyen de expérience,,,,
expérience : dimension cognitive,,expérience,,,,,,
émancipation : politique,mouvements socio-politiques,,,,,,*pour liberté,
arts visuels et littérature : art,,,,*par le moyen de culture visuelle,,,,*avec littérature
langue française : langue,,,,,,France,,
banlieue : lieu,,,,,,*autour ville,,
cinéma : bouger,~plusieurs image,,,*est une espèce de art,,,,
langue autochtone : langue,,,,,,,,~possessif abstrait ~plusieurs autochtone
méthodes de recherche basées sur l'art : méthode,,,,*par le moyen de art,,,,
enseignement/apprentissage du français : enseignement,,langue française,,,,,*a pour but apprentissage,
arts plastiques : transformer,~plusieurs art,matériau,,,,,,
sororité : politique,mouvements socio-politiques,,,*en relation avec sœur,,,,*pro femme
approches pédagogiques innovantes : enseignement,,,,*par le moyen de ~plusieurs innovation,,,,
sonnet : littérature,,,,*a pour propriété douze vers,,,,poésie
comique : littérature,,,,,,,,*motivé par faire rire
didactique de la littérature : enseignement,,littérature,,,,,,*avec méthode
déclin de la langue : parler,,langue française,,*subit la mutation déclin,,,,
incohérence : négativité,,incohérence,,,,,,
cinéma utilitaire : cinéma,,,,,,,*pour utilité,
pragmatique : linguistique,,pragmatique,,,,,,
enseignement littéraire : enseignement,,littérature,,,,,,
citoyenneté linguistique : politique,être citoyen,,,*au sujet de langue,,,,
théorie des climats : théorie,,~plusieurs climat,,,,,,
acquisition d'une langue seconde : apprentissage,,acquisition,,*a pour résultat accomplissement,,,*dans le contexte de maîtrise d'une seconde langue,
récit de vie : littérature,mettre en récit,,,,,,se comprendre soi-même,
perceptions : dimension cognitive,,~plusieurs perception,,,,,,
intertextualité : théorie,,texte,,,,*entre ~plusieurs texte,,
théorie postcoloniale : théorie,étude critique,,,,*après colonialisme,,,
pragmatique : linguistique,,pragmatique,,,,,,
écopoétique : littérature,,,,,,,*inspiré par environnement naturel,poésie
cinéma et littératrure : cinéma,,,,,,,,*avec littérature
maison-musée : localiser,,maison,,*est une espèce de musée,,,,
roman : raconter,,,,,longuement,,,*sans poésie (en prose)

## Mots du dictionnaire 
Tu dois utiliser les mots ci-dessous pour définir le mot-clé "${keyword}":
${context}

Ta réponse prendra la forme d'un CSV à 9 colonnes, les entêtes de colonnes sont: 
'thème, qui, quoi, à qui, par quoi, quand, où, pourquoi, comment'
Il n'est pas nécessaire de remplir tous les champs. Un champs peut rester vide entre deux virgules, comme dans les exemples. 
Répond uniquement avec une ligne CSV finale, sans explication.`;

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/Meta-Llama-3-70B-Instruct-Turbo",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error(await response.text());
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
