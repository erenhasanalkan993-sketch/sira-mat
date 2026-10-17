
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: number;
  username: string;
  platform: "Lichess" | "Chess.com";
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState<"Lichess" | "Chess.com">("Lichess");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  

async function loadPlayers() {
  const { data, error } = await supabase
    .from("queue_players")
    .select("id, username, platform")
    .eq("status", "waiting")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Sıra yüklenemedi:", error.message);
    return;
  }

  setPlayers(data as Player[]);
}

useEffect(() => {
  loadPlayers();

  const interval = setInterval(() => {
    loadPlayers();
  }, 5000);

  return () => clearInterval(interval);
}, []);

  async function joinQueue() {
  const name = username.trim();

  if (!name) {
    alert("Lütfen kullanıcı adını yaz.");
    return;
  }

  const { data: existing, error: checkError } = await supabase
    .from("queue_players")
    .select("id")
    .eq("platform", platform)
    .ilike("username", name)
    .in("status", ["waiting", "called"])
    .limit(1);

  if (checkError) {
    alert("Sıra kontrol edilemedi. Bağlantı ayarlarını kontrol et.");
    console.error(checkError.message);
    return;
  }

  if (existing && existing.length > 0) {
    alert("Bu oyuncu zaten sırada veya çağrılmış.");
    return;
  }

  const { error } = await supabase
    .from("queue_players")
    .insert({
      username: name,
      platform: platform,
      status: "waiting",
    });

  if (error) {
    alert("Sıraya katılınamadı. Lütfen tekrar dene.");
    console.error(error.message);
    return;
  }

  setUsername("");
  await loadPlayers();
  alert("Başarıyla sıraya katıldın!");
}

  function callNextPlayer() {
    if (players.length === 0) {
      alert("Sırada bekleyen oyuncu yok.");
      return;
    }

    setCurrentPlayer(players[0]);
    setPlayers((old) => old.slice(1));
  }

  function finishMatch() {
    setCurrentPlayer(null);
  }

 async function removePlayer(id: number) {
  const { error } = await supabase
    .from("queue_players")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Oyuncu silinemedi: " + error.message);
    return;
  }

  await loadPlayers();
}

  return (
    <main className="page">
      <header className="topbar">
        <a className="logo" href="#">♟ SIRA MAT</a>
        <button className="adminButton" onClick={() => setAdminMode(!adminMode)}>
          {adminMode ? "Oyuncu ekranı" : "Yönetici"}
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow">♞ CANLI SATRANÇ SIRASI</div>
        <h1>Hamleni bekle.<br /><span>Sıran gelsin.</span></h1>
        <p>Kaydol, sıraya katıl ve Lichess veya Chess.com üzerinden karşılaşma fırsatı yakala.</p>
      </section>

      {!adminMode ? (
        <section className="panel">
          <h2>Sıraya katıl</h2>
          <p className="muted">Satranç platformundaki kullanıcı adını gir.</p>

          <label htmlFor="username">Kullanıcı adın</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Örn. satrancoyuncusu"
            onKeyDown={(event) => {
              if (event.key === "Enter") joinQueue();
            }}
          />

          <label htmlFor="platform">Oynadığın platform</label>
          <select
            id="platform"
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as "Lichess" | "Chess.com")
            }
          >
            <option value="Lichess">Lichess</option>
            <option value="Chess.com">Chess.com</option>
          </select>

          <button className="primaryButton" onClick={joinQueue}>
            Sıraya gir →
          </button>

          <div className="notice">
            <span>ⓘ</span>
            Sıra sistemi şu anda deneme sürümünde. Sayfa yenilenirse sıra sıfırlanır.
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>Yönetici paneli</h2>
          {!admin ? (
            <>
              <p className="muted">Yönetici ekranını açmak için şimdilik deneme şifresi: <strong>mat123</strong></p>
              <label htmlFor="password">Yönetici şifresi</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifre"
              />
              <button
                className="primaryButton"
                onClick={() => {
                  if (password === "mat123") setAdmin(true);
                  else alert("Şifre yanlış.");
                }}
              >
                Giriş yap
              </button>
            </>
          ) : (
            <>
              <p className="muted">Sırayı buradan yönetebilirsin.</p>
              <button className="primaryButton" onClick={callNextPlayer}>
                Sıradaki oyuncuyu çağır
              </button>
              {currentPlayer && (
                <div className="currentPlayer">
                  <strong>Şu an çağrılan oyuncu</strong>
                  <p>{currentPlayer.username} · {currentPlayer.platform}</p>
                  <a
                    className="profileLink"
                    href={
                      currentPlayer.platform === "Lichess"
                        ? `https://lichess.org/@/${encodeURIComponent(currentPlayer.username)}`
                        : `https://www.chess.com/member/${encodeURIComponent(currentPlayer.username)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Oyuncu profilini aç ↗
                  </a>
                  <button className="secondaryButton" onClick={finishMatch}>
                    Oyunu tamamlandı olarak işaretle
                  </button>
                </div>
              )}
              <button className="secondaryButton" onClick={() => setAdmin(false)}>
                Yönetici oturumunu kapat
              </button>
            </>
          )}
        </section>
      )}

      <section className="queueSection">
        <div className="queueHeading">
          <div>
            <div className="eyebrow">BEKLEYENLER</div>
            <h2>Oyuncu sırası</h2>
          </div>
          <div className="count">{players.length} oyuncu</div>
        </div>

        {players.length === 0 ? (
          <div className="emptyState">
            <div className="chessIcon">♙</div>
            <strong>Sıra henüz boş</strong>
            <p>İlk oyuncu sen olabilirsin.</p>
          </div>
        ) : (
          <div className="playerList">
            {players.map((player, index) => (
              <div className="playerRow" key={player.id}>
                <div className="position">{index + 1}</div>
                <div className="playerInfo">
                  <strong>{player.username}</strong>
                  <span>{player.platform}</span>
                </div>
                {admin && (
                  <button
                    className="removeButton"
                    onClick={() => removePlayer(player.id)}
                  >
                    Çıkar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer>♟ SIRA MAT <span>·</span> Satranç severler için yapıldı</footer>
    </main>
  );
}
