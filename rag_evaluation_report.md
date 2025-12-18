---
title: Report of the RAG evaluation for translation of keywords into IEML
date: nov 15 25
author: Alexia Schneider
---

# Goal of the evaluation

**This evaluation aims to assess quantitatively and qualitatively the potential or not the translation provided by a RAG can as a good enough reference point for the user.** The user being tasked to correct the translation.

# Dataset

Training = Examples : 50 examples
Test = Ground truth = 361 examples translated by Pierre Levy

Validation and test sets are the same with contextual learning. 

## Evaluation

Metrics: 

1. BLEU score for lexical overlap
2. Cosine Similarity for semantic similarity (embeddings: sentence Transformer `all-MiniLM-L6-v2`) 

The two metrics are averaged (0.5 each). 

3. Human evaluation by IEML inventor Pierry Levy. 

Input/output token and latency are not considered for the evaluation because the 'translate into IEML' feature is not meant to be done in rapid succession and the extension engages the user into a reflexive process that (reasonnable) waiting times should not deter. 


# Evaluation

## Chunking method 

2 Methods are compared: 
- giving selected pages of the IEML dictionnary as context
- giving selected words

### Retrieving pages

A LLM is tasked to select pages of the IEML dictionnary based on the list of pages name. The entirety of the pages are later given as context for the translation prompt. 

This strategy is set aside as a series of empirical tests showed that 2 different models were overwhelmed by the length of the context provided, even with an input threshold of a couple of pages, the quality of the translations were incoherent with the task demanded.

Prompts are provided in Annex [@sec-ripages]. 

 An example of such translations is provided in the directory `chunking_dictPages`. 

### Retrieving words 

Evaluation based on a smaller dataset of 50 keywords using in total 170 words from the dictionnary to be translated. 

Retrieval strategies (top-k = 20) :
1. TF-IDF 
2. Embeddings 
3. Hybrid (0.5 each)
4. Embeddings with prompt "Mots pour définir le terme {keyword}"

The method scores a point for each retrieved word of the dictionnary found in the ground truth translation. 

IR strategy|score (out of 170)
---|--
tfidf|15
embd|25
hybrid|23
embd_prompt|15

Although all the scores appear to be low, the task of translating into IEML cannot rely solely on a single ground truth. In other words, a proposed translation can be just as exact as the ground truth without using any of the ground truth's words. 

Therefore, qualitative analysis of the retrieved word is just as important. Concerning TF-iDF, it gives either words that are exactly similar or unrelated terms semantically. Semantic search performed with `intfloat/multilingual-e5-large-instruct` embeddings provides more relevant words for a possible translation. This model is chosen because it has a Together API endpoint, is multilingual and performed well in the Massive Multilingual Text Embedding Benchmark [@enevoldsenMMTEBMassiveMultilingual2025]. 

Hybrid (half each) showed that the words retrieved are not of better quality and might give more 'noise' than useful words. 

Trying to oriente the search with a prompt also decreased the quality of the retrieved context: the model tends to focus on grammatical aspects rather than semantics.

## Translation/final ouput

## Models

List of models tried and dismissed after 2 to 5 requests:

- mistralai/Mistral-7B-Instruct-v0.3 (hallucinates, repetitions of words and col names)
- togethercomputer/m2-bert-80M-32k-retrieval aka Apriel 1.5 15B Thinker (empty replies)
- nvidia/NVIDIA-Nemotron-Nano-9B-v2 (CoT type of model)
- arcee-ai/AFM-4.5B (nonsense)

Compared models for the final translation

1. meta-llama/Meta-Llama-3-70B-Instruct-Turbo
2. google/gemma-3n-E4B-it,
3. openai/gpt-oss-20b


### Preprocessing of the output

For all models (including the Llama in few-shot) the output was 'parsed' and formatted into a CSV with 9 columns (removed extra columns and added extra columns if under 9). 

This simple formatting is meant to give a fair chance to models who might struggle more with CSV formatting and allow for an evaluation on semantic grounds. 

### Results

Baseline is meta-llama/Meta-Llama-3-70B-Instruct-Turbo in few-shot prompting without context.

See [@sec-mainprompt] for transcription of the prompt used for all models. 

model/strategy|BLEU|Cosine|avg|
------|-----|----|----|
baseline|0.056|0.515|0.286
rag_llama_fewshot|0.0222|0.555|**0.289**
rag_gemma_fewshot|0.020|0.491|0.255
rag_openai_fewshot|0.0167|0.498|0.257
rag_llama_zeroshot|0.0129|0.514|0.263
rag_gemma_zeroshot|0.0160|0.479|0.248
rag_openai_zeroshot|0.016|0.493|0.254

Context (words from the dictionnary) improves quantitative performance across all models. 


### Qualitative analysis

Main and most commons errors assessed by Pierre Levy. 

Baseline: 1. Semantic and logical nonsense (e.g. "minor literature" translated as "literature written by a minority"). 2. no respect of IEML grammar structure (only noun as theme where verbs should be etc.)  


# Annex


## Output example from dismmissed models {#sec-arcee}

`arcee-ai/AFM-4.5B `  

> altérité,mot à traduire,dualité,qui,qui,et qui,quand,dans quel contexte,ou par quelle raison,comment pourrait-on moissonner son sensMais attention, l'équilibrage du champ \"quand\" est marginalement éloigné du contexte du mot tout court, mais cela pourrait être interpreté dans une perspective philosophique longueue. moins le \"ou\" transmet désorienté contreordinaire, tout simplement car il n'a pas de sens de transmission proprement étant.

`marin-community/marin-8b-instruct` 

> theme,allarme,qui,long thảo,par le donnant de serre,quand,monde,le,pourquoi,pourquoi,comments chalk,่-с exclus sont，並upaient Emmanuel，比 Colombia Laatений меня ait穿 sousblessaGINE Household Seras Land studies cope c الط Kan flea Night 购 vanishedít擺 fell перест 손 sore ach raged 때(path s涉 rooted gebru exit iron 

## Prompts for page selection {#sec-ripages} 

>`IEML est un langage qui permet de décomposer sémantiquement un concept à partir des aspects "mot,theme,qui,quoi,à qui,par quoi,quand,où,pourquoi,comment".
   Un concept ne peut être décomposé qu'à partir des mots déjà traduits en IEML et présents dans le dictionnaire. 
   Pour traduire le mot-clé "${keyword}" en IEML tu auras besoin du vocabulaire présent dans certaines pages du dictionnaire IEML.
   Sélectionne au maximum 10 pages pertinentes dans la liste suivante.
   Répond uniquement avec leurs titres exacts (page-title), séparés par des virgules.

   Liste des pages disponibles:
   [Functional roles, Primitives, Technical functions, Human development, Operations, Actions & agents, Disciplines & their objects, ... etc.]`;

Prompt for Translation: 

> `Tu es un agent traducteur IEML. 
Tu disposes des pages suivantes du dictionnaire IEML pour traduire le mot "${keyword}":  

${context}

Traduis le mot-clé "${keyword}" en IEML sous la forme :
mot,theme,qui,quoi,a_qui,par_quoi,quand,ou,pourquoi,comment.
Répond uniquement avec la ligne CSV finale, sans explication.`;


## Final output Prompt {#sec-mainprompt}

```Tu es un expert en sémantique. Tu dois décomposer sémantiquement le mot-clé "${keyword}" à partir des 9 valeurs suivantes :
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
Répond uniquement avec une ligne CSV finale, sans explication.
```


## Qualitative evaluation by Pierry Levy on the baseline


1) ABSURDITÉ LOGIQUE ET SÉMANTIQUE
- Définir les mots (ou concepts) à définir au moyen des mots (ou concepts) à définir eux-mêmes : voir par exemple les définitions de autochtone et chanteur. Il y en a plein d’autres.
- Mauvaises définitions. Par exemple : littérature mineure = écrite par une minorité

2) NON-GRAMMATICALITÉ
Ne pas respecter la grammaire : 
- 10 rôles au lieu de 9, 
- incohérence entre les prépositions et les rôles grammaticaux, 
- ne jamais utiliser de verbes en rôle zéro mais les utiliser pour d’autres rôles (par exemple en rôle d’objet)
- aucune utilisation des flexions verbales
- etc.

3) UTILISATION DE MOTS OU EXPRESSIONS QUI NE SONT PAS DANS LE DICTIONNAIRE

4) INCOHÉRENCE STRUCTURELLE
- Ne pas organiser les phrases IEML selon des quasi paradigmes : il faudrait arranger des définitions avec un maximum de mots communs dans le même rôle et des *petites* variations, ceci afin de créer des “champs sémantiques" à explorer
- Trop verbeux. Il faut utiliser le minimum de mots : rasoir d’Occam


## Qualitative evaluation by Pierre Levy on the models 

<!-- ### 1.1 llama zeroshot


 a- Redondance inutile une fois qu'on a dit violence 

b- Je ne vois pas de concepts qui aide à faire des regroupements sémantiques

c- Ne respecte pas la grammaire : "détruire" est en destinataire (3) or un verbe devrait être en rôle 0. 

Point positif: Néanmoins les rôles 4 (instrument/cause), 5 (temps) 7 (intention) et 8 (manière) sont corrects

d- détruire ou pendant conflit ajoute quelque chose au mot clé. Pareil pour système, ressource, etc.


### 1.2 llama fewshots


a- Grande redondance

b- Pas de concepts qui aide à faire des regroupements sémantiques

c- Respecte la grammaire! 

d- Ajoute des concepts

2.1 gemma zeroshot


Translations_2 est TRÈS bizarre : 

a- Grande et inutile redondance

b- Pas de concepts qui aide à faire des regroupements sémantiques

c- Tous les rôles 0 sont occupés par le mot “thème” (confusion du nom du rôle grammatical et du concept qui l’occupe). Les rôles 5 (temps) 6 (lieu) 7 (intention) et 8 (manière) sont remplis n'importe comment

d- Combattant, victime, destruction *ajoutent* des concepts. Je vois, au hasard, que “littérature africaine” a “mort” en rôle 8 (manière)... ce qui n'a aucun rapport

### 2.2 gemma fewshots


a- Violence en rôle 0 et en rôle 4 !

b- Pas de concepts qui aide à faire des regroupements sémantiques

c- Rôle 1, 5 : confusuion du rôle et de l'actant qui remplit le rôle! 7 est l'intention et il me met "où". Divers endroits n'est pas un complément de manière. Action en rôle de destinataire. Aggresseur en rôle d'objet! Quoi en rôle de destinataire....

d- ajoute des concepts: divers endroits

### 3.1 openai zeroshot


a- Redondance

b- Pas de concepts qui aide à faire des regroupements sémantiques

c- Dans exploitation "opportunisme" n'est pas un complément de temps

d- Menace ajoute quelque chose. Dans le cas de "exploitation" esclavage, captivité, opportunisme, destruction, tromperie ajoutent quelque chose

### 3.2 openai fewshots


a- Redondance: exploitation, exploiter

b- Pas de concepts qui aide à faire des regroupements sémantiques

c- Grammaire : exploiter devrait être en rôle 0 (verbe). 

d- Ajoute des concepts: militant, civil, grenade, tuer, pays arbitrage, corruption, etc.

### SYNTHÈSE : 

Les traductions 10 et 30 semblent les moins atroces (parce qu'elles ne massacrent pas trop la grammaire), mais je n'ai pas tout vérifié.

Au mieux les "traductions" font des associations d'idées au lieu de phrases de définition. Au pire c'est n'importe quoi. Presque toutes les définitions *ajoutent* des traits sémantiques qui n'appartiennent pas au mot clé.

Aucune ne respecte le rasoir d'Occam, aucune ne ménage des relations de ressemblance / différentiation sémantique entre mots-clés, ce qui est le propre de toute bonne ontologie IEML et qui est justement l'objectif que l'on veut atteindre. -->

Translation of llama_fewshots and openai_fewshots seem to be the least atrocious.

At best, the translations operate on an idea connections instead of defining sentences. At worse, it's nonsense. Almost all definitions (2 evaluated) added semantic features not belonging to the keyword. No model followed Occam's razor principle and none managed to build significant semantic differences between keywords, which is at the core of an IEML ontology and our goal for the app. 

# Bibliography