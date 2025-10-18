import React, { useEffect, useMemo, useRef, useState } from "react";

// ================== CONFIG GERAL ==================
const FEEDBACK_DELAY_MS = 5000; // 5s
const PHASE_SIZE = 5;

const AVATARS = [
  { id: "ze",   name: "Zé",   emoji: "😎", tagline: "Descolado, sempre no estilo!" },
  { id: "kako", name: "Kako", emoji: "🤓", tagline: "Nerd esperto, focado no 100!" },
  { id: "lia",  name: "Lia",  emoji: "😊", tagline: "Criativa e otimista!" },
  { id: "dora", name: "Dora", emoji: "😏", tagline: "Estratégica, resolve tudo!" },
];

const MODES = [
  { id: "IFES", label: "IFES", csv: "/data/ifes_2022_2024_simplificado.csv" },
  { id: "ENEM", label: "ENEM", csv: "/data/enem_2022_2024_simplificado.csv" },
];

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };
const INDEX_TO_LETTER = ["A","B","C","D"];

const MOTIVATIONAL = [
  "Mandou bem! 🚀", "Show! 👏", "Acertou em cheio! 🎯", "Top demais! ✨",
  "Você tá voando! 🛫", "Excelente! 🧠", "Brilhou agora! 🌟", "Muito bem! ✅"
];
const FUNNY_WRONG = [
  "Vai estudar mais e volte amanhã… 😅", "Quase! Tenta a próxima. 😉",
  "Respira e vai de novo. 😌", "Anota e revisa depois. 📝", "Não desanima! 💪"
];

// ================== SONS (WebAudio simples) ==================
function useSFX() {
  const ctxRef = useRef(null);
  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }
  function beep({ freq=880, duration=0.12, type="sine", volume=0.2 }) {
    const ctx = ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = volume; o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.stop(ctx.currentTime + duration);
  }
  return {
    correct(){ beep({freq:1046,type:"triangle"}); setTimeout(()=>beep({freq:1318,type:"triangle"}),110); },
    wrong(){ beep({freq:180, type:"sawtooth"}); },
    medal(){ beep({freq:740, type:"square"}); setTimeout(()=>beep({freq:880,type:"square"}),120); setTimeout(()=>beep({freq:988,type:"square"}),240); }
  };
}

// ================== CONFETTI (sem libs) ==================
function ConfettiBurst({ trigger }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const EMOJIS = ["🎉","✨","🎊","💥","🔥","🌟"];
    const count = 36;
    const arr = Array.from({ length: count }).map((_, i) => ({
      id: `${trigger}-${i}`,
      emoji: EMOJIS[Math.floor(Math.random()*EMOJIS.length)],
      left: Math.random()*100, top: 25+Math.random()*10,
      dx: (Math.random()-0.5)*220, dy: 180+Math.random()*320,
      rot: (Math.random()-0.5)*720
    }));
    setItems(arr);
    const t = setTimeout(()=>setItems([]), 1200);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {items.map(p => (
        <div
          key={p.id}
          style={{
            position:"absolute",
            left:`${p.left}%`,
            top:`${p.top}%`,
            fontSize:24,
            transform:`translate(0,0) rotate(0deg)`,
            animation:`confetti-move 1.1s ease-out forwards`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rot": `${p.rot}deg`
          }}
        >
          {p.emoji}
        </div>
      ))}
      <style>{`
        @keyframes confetti-move {
          to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ================== CSV PARSER simples ==================
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue; }
      if(c==='"'){ inQ=false; i++; continue; }
      field+=c; i++; continue;
    } else {
      if(c==='"'){ inQ=true; i++; continue; }
      if(c===','){ row.push(field); field=''; i++; continue; }
      if(c==='\n' || c==='\r'){
        if(field!=='' || row.length){ row.push(field); rows.push(row); }
        field=''; row=[]; i++;
        if(c==='\r' && text[i]==='\n') i++;
        continue;
      }
      field+=c; i++;
    }
  }
  if(field!=='' || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(x=>x && x.length)).map(r => Object.fromEntries(header.map((h,idx)=>[h,(r[idx]??'').trim()])));
}

// ================== UI AUX ==================
function Chip({ children }) {
  return (
    <span style={{
      padding:"4px 8px", borderRadius:999, background:"rgba(2,6,23,.75)",
      color:"#fff", fontSize:12, fontWeight:600, border:"1px solid rgba(255,255,255,.2)"
    }}>
      {children}
    </span>
  );
}

// ================== APP ==================
export default function App(){
  const sfx = useSFX();

  const [mode, setMode] = useState(null);       // IFES | ENEM
  const [avatar, setAvatar] = useState(null);   // personagem
  const [playerName, setPlayerName] = useState("");
  const [started, setStarted] = useState(false);

  const [rawData, setRawData] = useState({ IFES: [], ENEM: [] });
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [phaseCorrect, setPhaseCorrect] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [phaseMedal, setPhaseMedal] = useState(null);
  const [burstId, setBurstId] = useState(0);

  // ---- carrega CSVs automaticamente (sem botão) ----
  useEffect(() => {
    async function loadAll() {
      try {
        const get = async (csvUrl) => {
          const res = await fetch(csvUrl, { cache: "no-store" });
          const text = await res.text();
          const recs = parseCSV(text);
          // normaliza
          return recs.map(r => ({
            mode: (r.mode || "").toUpperCase(),
            id: r.id,
            year: Number(r.year),
            subject: r.subject || "",
            difficulty: r.difficulty || "",
            stem: r.stem || "",
            options: [r.option_a, r.option_b, r.option_c, r.option_d].filter(Boolean),
            correct: LETTER_TO_INDEX[(r.correct||"").trim().toUpperCase()] ?? 0,
            feedbackRight: r.feedback_correct || MOTIVATIONAL[Math.floor(Math.random()*MOTIVATIONAL.length)],
            feedbackWrong: r.feedback_wrong || FUNNY_WRONG[Math.floor(Math.random()*FUNNY_WRONG.length)],
          }));
        };
        const [ifes, enem] = await Promise.all([
          get("/data/ifes_2022_2024_simplificado.csv"),
          get("/data/enem_2022_2024_simplificado.csv")
        ]);
        setRawData({ IFES: ifes, ENEM: enem });
      } catch (e) {
        alert("Não foi possível carregar as perguntas. Verifique se os CSVs estão em public/data/");
      }
    }
    loadAll();
  }, []);

  const pool = useMemo(() => (mode ? rawData[mode] : []), [mode, rawData]);
  const current = pool[index];
  const gameFinished = index >= pool.length;

  function resetGame(){
    setStarted(false); setIndex(0); setScore(0); setStreak(0);
    setPhaseCorrect(0); setFeedback(null); setPhaseMedal(null); setBurstId(0);
  }

  function chooseAnswer(i){
    if(!current) return;
    const isRight = i === current.correct;

    if(isRight){
      sfx.correct();
      setScore(s=>s+1);
      setStreak(k=>k+1);
      setPhaseCorrect(p=>p+1);
      setFeedback({type:"right", text: current.feedbackRight || MOTIVATIONAL[Math.floor(Math.random()*MOTIVATIONAL.length)]});
      setBurstId(b=>b+1); // confetti
    } else {
      sfx.wrong();
      setStreak(0);
      setFeedback({type:"wrong", text: current.feedbackWrong || FUNNY_WRONG[Math.floor(Math.random()*FUNNY_WRONG.length)]});
    }

    // avança após delay
    setTimeout(()=>{
      const next = index+1;
      const reached = next % PHASE_SIZE === 0;
      setIndex(next);
      setFeedback(null);
      if(reached){
        const dance = phaseCorrect + (isRight?1:0) >= Math.ceil(PHASE_SIZE/2);
        setPhaseMedal({ phase: next/PHASE_SIZE, total: next, dance });
        sfx.medal();
        setPhaseCorrect(0);
      }
    }, FEEDBACK_DELAY_MS);
  }

  // ========= ESTILOS BÁSICOS =========
  const card = { background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.2)", borderRadius:16, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,.25)" };
  const button = (active=false) => ({
    borderRadius:16, padding:16, textAlign:"left", border:"1px solid rgba(255,255,255,.2)",
    background: active ? "#A7F3D0" : "rgba(255,255,255,.10)",
    color: active ? "#0f172a" : "#fff",
    cursor:"pointer"
  });

  return (
    <div style={{
      minHeight:"100vh", width:"100%", padding:16, color:"#fff",
      background:"linear-gradient(180deg, #0ea5e9, #7c3aed)"
    }}>
      {/* Confetti overlay */}
      <ConfettiBurst trigger={burstId} />

      <div style={{ maxWidth:900, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
          <h1 style={{ fontSize:36, fontWeight:900, textShadow:"0 6px 24px rgba(0,0,0,.35)", margin:0 }}>
            Trilha do Conhecimento
          </h1>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {mode && <Chip>{mode}</Chip>}
            {avatar && <Chip>{avatar.emoji} {avatar.name}</Chip>}
            {playerName && <Chip>{playerName}</Chip>}
            <Chip>Score: {score}</Chip>
          </div>
        </div>

        {/* HOME */}
        {!started && (
          <section style={{ marginTop:24 }}>
            {/* Modo */}
            <h2 style={{ fontSize:20, fontWeight:800, margin:"12px 0" }}>Escolha a categoria</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:16 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={()=> setMode(m.id)} style={button(mode===m.id)}>
                  <div style={{ fontSize:20, fontWeight:800 }}>{m.label}</div>
                  <div style={{ opacity:.85 }}>Questões oficiais dos últimos 3 anos</div>
                </button>
              ))}
            </div>

            {/* Personagens */}
            <h2 style={{ fontSize:20, fontWeight:800, margin:"18px 0 12px" }}>Escolha seu personagem</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:16 }}>
              {AVATARS.map(a => (
                <button key={a.id} onClick={()=>setAvatar(a)} style={button(avatar?.id===a.id)}>
                  <div style={{ fontSize:32, marginBottom:6 }}>{a.emoji}</div>
                  <div style={{ fontSize:18, fontWeight:700 }}>{a.name}</div>
                  <div style={{ fontSize:14, opacity:.85 }}>{a.tagline}</div>
                </button>
              ))}
            </div>

            {/* Nome + Iniciar */}
            <div style={{ marginTop:18, display:"grid", gap:8 }}>
              <input
                value={playerName}
                onChange={(e)=>setPlayerName(e.target.value)}
                placeholder="Digite seu nome/apelido"
                style={{
                  width:"100%", padding:"12px 16px", borderRadius:14,
                  border:"1px solid rgba(255,255,255,.35)", background:"rgba(255,255,255,.12)",
                  color:"#fff"
                }}
              />
              <div style={{ fontSize:12, opacity:.9 }}>Esse nome aparece no topo e no ranking 🏆</div>
              <div style={{ marginTop:6 }}>
                <button
                  disabled={!mode || !avatar}
                  onClick={()=>{ setStarted(true); setIndex(0); setScore(0); setStreak(0); setPhaseCorrect(0); }}
                  style={{
                    padding:"12px 18px", borderRadius:16, fontWeight:800,
                    background: (!mode || !avatar) ? "rgba(255,255,255,.25)" : "#34d399",
                    color: (!mode || !avatar) ? "#e5e7eb" : "#0f172a",
                    border:"none", cursor: (!mode || !avatar) ? "not-allowed" : "pointer", boxShadow:"0 8px 28px rgba(0,0,0,.25)"
                  }}
                >
                  Iniciar Fase 1
                </button>
              </div>
            </div>
          </section>
        )}

        {/* GAMEPLAY */}
        {started && !gameFinished && current && (
          <section style={{ marginTop:24, ...card }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:14, opacity:.9 }}>
                <strong>[{mode} {current.year}]</strong> — Pergunta {index+1} de {pool.length}
              </div>
              <div style={{ fontSize:14, opacity:.9 }}>Matéria: {current.subject}</div>
            </div>

            <div style={{ fontSize:18, fontWeight:700, marginBottom:14, textShadow:"0 2px 10px rgba(0,0,0,.2)" }}>
              {current.stem}
            </div>

            <div style={{ display:"grid", gap:10 }}>
              {current.options.map((opt, i) => (
                <button key={i} onClick={()=>chooseAnswer(i)}
                  style={{
                    textAlign:"left", padding:"12px 14px", borderRadius:12,
                    background:"rgba(15,23,42,.45)", color:"#fff",
                    border:"1px solid rgba(255,255,255,.15)", cursor:"pointer"
                  }}>
                  <span style={{ fontWeight:800, marginRight:8 }}>{INDEX_TO_LETTER[i]}.</span> {opt}
                </button>
              ))}
            </div>

            {feedback && (
              <div style={{
                marginTop:14, padding:12, borderRadius:12, fontSize:14, fontWeight:700,
                background: feedback.type==="right" ? "#34d399" : "#fb7185",
                color:"#0f172a"
              }}>
                {feedback.text}
              </div>
            )}

            <div style={{ marginTop:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <Chip>Streak: {streak}</Chip>
              <Chip>Fase: {Math.floor(index/PHASE_SIZE)+1}</Chip>
              <Chip>Acertos na fase: {phaseCorrect}</Chip>
            </div>
          </section>
        )}

        {/* FIM */}
        {started && gameFinished && (
          <section style={{ marginTop:32, textAlign:"center" }}>
            <div style={{ fontSize:42 }}>🏁</div>
            <h2 style={{ fontSize:24, fontWeight:900, marginTop:8 }}>Fim do conjunto de {mode}!</h2>
            <p style={{ opacity:.9, marginTop:6 }}>Pontuação final: {score}</p>
            <div style={{ marginTop:16, display:"flex", gap:10, alignItems:"center", justifyContent:"center" }}>
              <button onClick={resetGame}
                style={{ padding:"12px 18px", borderRadius:16, fontWeight:800, background:"#fbbf24", color:"#0f172a", border:"none", cursor:"pointer" }}>
                Jogar de novo
              </button>
            </div>
          </section>
        )}
      </div>

      {/* OVERLAY: MEDALHA + DANÇA */}
      {phaseMedal && (
        <div
          onClick={()=>setPhaseMedal(null)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)",
            display:"flex", alignItems:"center", justifyContent:"center", padding:16
          }}
        >
          <div style={{ background:"#fff", color:"#0f172a", borderRadius:24, padding:24, width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize:26, marginBottom:8 }}>Parabéns!</div>
            <div style={{ fontSize:48, marginBottom:8 }}>🏅</div>
            <div style={{ fontWeight:700 }}>Fase {phaseMedal.phase} concluída!</div>
            <div style={{ color:"#475569", fontSize:14, marginTop:4 }}>Total de perguntas respondidas: {phaseMedal.total}</div>
            {phaseMedal.dance && <div style={{ marginTop:14, fontSize:48, animation:"bounce 0.9s infinite" }}>🕺💃</div>}
            <button onClick={()=>setPhaseMedal(null)}
              style={{ marginTop:16, width:"100%", padding:"12px 16px", borderRadius:14, fontWeight:800, background:"#10b981", color:"#fff", border:"none", cursor:"pointer" }}>
              Continuar
            </button>
          </div>
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
