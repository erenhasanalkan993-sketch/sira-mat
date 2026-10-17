
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimeControl =
  | "1+0"
  | "3+0"
  | "3+2"
  | "5+0"
  | "10+0"
  | "15+10";

type Player = {
  id: number;
  username: string;
  platform: "Lichess" | "Chess.com";
  time_control: TimeControl;
};

const timeControls: TimeControl[] = [
  "1+0",
  "3+0",
  "3+2",
  "5+0",
  "10+0",
  "15+10",
];

export default function Home() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] =
    useState<"Lichess" | "Chess.com">("Lichess");
  const [timeControl, setTimeControl] =
    useState<TimeControl>("3+0");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] =
    useState<Player | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("queue_players")
      .select("id, username, platform, time_control")
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Sıra yüklenemedi:", error.message);
      setLoading(false);
      return;
    }

    setPlayers((data ?? []) as Player[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadPlayers();

    const interval = setInterval(() => {
      void loadPlayers();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function callNextPlayer() {
    if (players.length === 0) {
      setMessage("Sırada bekleyen oyuncu yok.");
      return;
    }

    const nextPlayer = players[0];

    const { error } = await supabase
      .from("queue_players")
      .update({
        status: "called",
        called_at: new Date().toISOString(),
      })
      .eq("id", nextPlayer.id)
      .eq("status", "waiting");

    if (error) {
      setMessage("Oyuncu çağrılamadı: " + error.message);
      return;
    }

    setCurrentPlayer(nextPlayer);
    setPlayers((old) =>
      old.filter((player) => player.id !== nextPlayer.id)
    );
    setMessage("");
  }

  async function joinQueue() {
    if (joining) return;

    const name = username.trim();

    if (!name) {
      setMessage("Lütfen kullanıcı adını yaz.");
      return;
    }

    setJoining(true);
    setMessage("");

    try {
      const { data: existing, error: checkError } = await supabase
        .from("queue_players")
        .select("id, status, called_at, created_at")
        .ilike("username", name)
        .in("status", ["waiting", "called"])
        .order("created_at", { ascending: false });

      if (checkError) {
        setMessage("Sıra kontrol edilemedi: " + checkError.message);
        return;
      }

      if (existing?.some((player) => player.status === "waiting")) {
        setMessage("Bu nick zaten sırada.");
        return;
      }

      const lastCalled = existing?.find(
        (player) => player.status === "called" && player.called_at
      );

      if (lastCalled?.called_at) {
        const elapsed =
          Date.now() - new Date(lastCalled.called_at).getTime();
        const remaining = Math.ceil((60000 - elapsed) / 1000);

        if (remaining > 0) {
          setMessage(
            `Bu nick için tekrar sıraya girmek üzere ${remaining} saniye beklemelisin.`
          );
          return;
        }
      }

      const { error } = await supabase
        .from("queue_players")
        .insert({
          username: name,
          platform,
          time_control: timeControl,
          status: "waiting",
        });

      if (error) {
        setMessage("Sıraya katılınamadı: " + error.message);
        return;
      }

      setUsername("");
      setMessage("Başarılı! Sıranın sonuna eklendin. ♟");
      await loadPlayers();
    } finally {
      setJoining(false);
    }
  }

  function finishMatch() {
    setCurrentPlayer(null);
    setMessage("Karşılaşma tamamlandı.");
  }

  async function removePlayer(id: number) {
    const { error } = await supabase
      .from("queue_players")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage("Oyuncu silinemedi: " + error.message);
      return;
    }

    setMessage("Oyuncu sıradan çıkarıldı.");
    await loadPlayers();
  }

  async function loginAdmin() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage("E-posta veya şifre hatalı.");
      return;
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from("queue_admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !adminRecord) {
      await supabase.auth.signOut();
      setMessage("Bu hesabın yönetici yetkisi yok.");
      return;
    }

    setAdmin(true);
    setPassword("");
    setMessage("Yönetici girişi başarılı.");
  }

  async function logoutAdmin() {
    await supabase.auth.signOut();
    setAdmin(false);
    setAdminMode(false);
    setCurrentPlayer(null);
    setMessage("");
  }

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a
          className="brand"
          href="#"
          aria-label="SolbekErsin ana sayfa"
        >
          <span className="brand-icon">♞</span>
          <span>
            Solbek<span className="brand-accent">Ersin</span>
            <small>CHESS COMMUNITY</small>
          </span>
        </a>

        <button
          className="admin-toggle"
          onClick={() => {
            setAdminMode((old) => !old);
            setMessage("");
          }}
        >
          <span>{adminMode ? "♟" : "⚙"}</span>
          {adminMode ? "Oyuncu ekranı" : "Yönetici"}
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            CANLI SATRANÇ SIRASI
          </div>

          <h1>
            Hamleni bekle.
            <br />
            <span>Sıran gelsin.</span>
          </h1>

          <p className="hero-description">
            Rakibini bul, oyun süreni seç ve satranç mücadelesine katıl.
            Tahta seni bekliyor.
          </p>

          <a className="hero-link" href="#queue">
            Oyuncu sırasını keşfet <span>↓</span>
          </a>
        </div>

        <div className="hero-art" aria-label="Satranç atı">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-glow" />
          <span className="hero-knight">♞</span>
          <div className="hero-art-label">
            <span className="live-dot" />
            YOUR NEXT MOVE
          </div>
        </div>
      </section>

      <section className="main-grid">
        <section className="panel join-panel">
          <div className="panel-heading">
            <div className="section-icon">♟</div>
            <div>
              <div className="eyebrow">OYUNCU ALANI</div>
              <h2>{adminMode ? "Yönetici paneli" : "Sıraya katıl"}</h2>
            </div>
          </div>

          {!adminMode ? (
            <div className="form-content">
              <p className="muted">
                Bilgilerini gir, oyun tarzını seç ve yerini al.
              </p>

              <label htmlFor="username">Satranç kullanıcı adın</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Örn. satrancoyuncusu"
                maxLength={50}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void joinQueue();
                }}
              />

              <label htmlFor="platform">Oynadığın platform</label>
              <select
                id="platform"
                value={platform}
                onChange={(event) =>
                  setPlatform(
                    event.target.value as "Lichess" | "Chess.com"
                  )
                }
              >
                <option value="Lichess">Lichess</option>
                <option value="Chess.com">Chess.com</option>
              </select>

              <label htmlFor="timeControl">Oyun süresi</label>
              <select
                id="timeControl"
                value={timeControl}
                onChange={(event) =>
                  setTimeControl(event.target.value as TimeControl)
                }
              >
                {timeControls.map((control) => (
                  <option key={control} value={control}>
                    {control}
                    {control === "3+0" ? " · Popüler" : ""}
                  </option>
                ))}
              </select>

              <button
                className="primary-button"
                onClick={() => void joinQueue()}
                disabled={joining}
              >
                {joining ? "Sıraya ekleniyor..." : "Sıraya gir"}
                <span>↗</span>
              </button>

              {message && (
                <div className="feedback" role="status">
                  {message}
                </div>
              )}

              <div className="notice">
                <span>✳</span>
                Sıra otomatik olarak 5 saniyede bir yenilenir.
              </div>
            </div>
          ) : (
            <div className="form-content">
              {!admin ? (
                <>
                  <p className="muted">Yönetici hesabınla giriş yap.</p>

                  <label htmlFor="adminEmail">E-posta adresi</label>
                  <input
                    id="adminEmail"
                    type="email"
                    autoComplete="username"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="Yönetici e-postası"
                  />

                  <label htmlFor="password">Şifre</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Yönetici şifresi"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void loginAdmin();
                    }}
                  />

                  <button
                    className="primary-button"
                    onClick={() => void loginAdmin()}
                  >
                    Giriş yap <span>↗</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="admin-status">
                    <span className="live-dot" />
                    Yönetici oturumu açık
                  </div>

                  <p className="muted">
                    Bekleyen oyuncuları yönetebilir ve sıradaki oyuncuyu
                    çağırabilirsin.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => void callNextPlayer()}
                  >
                    Sıradaki oyuncuyu çağır <span>→</span>
                  </button>

                  {currentPlayer && (
                    <div className="current-player">
                      <div className="eyebrow">ÇAĞRILAN OYUNCU</div>
                      <h3>{currentPlayer.username}</h3>
                      <p>
                        {currentPlayer.platform} ·{" "}
                        {currentPlayer.time_control}
                      </p>

                      <a
                        className="profile-link"
                        href={
                          currentPlayer.platform === "Lichess"
                            ? `https://lichess.org/@/${encodeURIComponent(
                                currentPlayer.username
                              )}`
                            : `https://www.chess.com/member/${encodeURIComponent(
                                currentPlayer.username
                              )}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Profili aç ↗
                      </a>

                      <button
                        className="secondary-button"
                        onClick={finishMatch}
                      >
                        Oyunu tamamlandı işaretle
                      </button>
                    </div>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => void logoutAdmin()}
                  >
                    Oturumu kapat
                  </button>
                </>
              )}

              {message && (
                <div className="feedback" role="status">
                  {message}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel queue-panel" id="queue">
          <div className="queue-heading">
            <div>
              <div className="eyebrow">SIRADAKİ RAKİPLER</div>
              <h2>Oyuncu sırası</h2>
            </div>

            <div className="queue-count">
              <strong>{players.length}</strong>
              <span>oyuncu</span>
            </div>
          </div>

          <div className="queue-status">
            <span className="live-dot" />
            CANLI GÜNCELLENİYOR
          </div>

          {loading ? (
            <div className="empty-state">
              <span className="loading-spinner" />
              <strong>Sıra yükleniyor...</strong>
            </div>
          ) : players.length === 0 ? (
            <div className="empty-state">
              <div className="empty-chess">♙</div>
              <strong>Tahta seni bekliyor</strong>
              <p>Henüz sırada oyuncu yok. İlk hamleyi sen yap!</p>
            </div>
          ) : (
            <div className="player-list">
              {players.map((player, index) => (
                <div className="player-row" key={player.id}>
                  <div className="player-position">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="player-avatar">
                    {player.username.charAt(0).toUpperCase()}
                  </div>

                  <div className="player-info">
                    <strong>{player.username}</strong>
                    <span>{player.platform}</span>
                  </div>

                  <span className="time-badge">{player.time_control}</span>

                  {admin && (
                    <button
                      className="remove-button"
                      onClick={() => void removePlayer(player.id)}
                      aria-label={`${player.username} oyuncusunu sıradan çıkar`}
                      title="Oyuncuyu sıradan çıkar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="queue-footer">
            <span>♟</span>
            <p>Her oyun yeni bir hikâye.</p>
            <span className="footer-spark">✳</span>
          </div>
        </section>
      </section>

      <footer className="site-footer">
        <a
          className="footer-brand"
          href="#"
          aria-label="SolbekErsin ana sayfa"
        >
          ♞ SolbekErsin
        </a>

        <span>STRATEJİNİ KONUŞTUR.</span>

        <div className="social-links">
          <a
            href="https://www.youtube.com/@SolBekErsun"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SolbekErsin YouTube kanalı"
            title="YouTube"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
            </svg>
            <span>YouTube</span>
          </a>

          <a
            href="https://www.tiktok.com/@solbek.ersin"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SolbekErsin TikTok hesabı"
            title="TikTok"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M19.6 6.1a5.5 5.5 0 0 1-3.4-4.5V1h-4.4v15.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a7.4 7.4 0 1 0 6.4 7.3V8.6a9.8 9.8 0 0 0 5.7 1.8V6a5.5 5.5 0 0 1-2.3.1Z" />
            </svg>
            <span>TikTok</span>
          </a>
        </div>

        <span>© 2026 SolbekErsin</span>
      </footer>
    </main>
  );
}
