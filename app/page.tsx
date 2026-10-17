
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type TimeControl = "1+0" | "3+0" | "3+2" | "5+0" | "10+0" | "15+10";
type Platform = "lichess" | "chess.com";

type Player = {
  id: number;
  name: string;
  platform: Platform;
  timeControl: TimeControl;
};

type Cooldowns = Record<string, number>;

const COOLDOWN_MS = 60 * 1000;
const COOLDOWN_STORAGE_KEY = "solbekersin-user-cooldowns";

const timeControls: { value: TimeControl; label: string }[] = [
  { value: "1+0", label: "1+0" },
  { value: "3+0", label: "3+0 · Popüler" },
  { value: "3+2", label: "3+2" },
  { value: "5+0", label: "5+0" },
  { value: "10+0", label: "10+0" },
  { value: "15+10", label: "15+10" },
];

function getProfileUrl(player: Player): string {
  const username = encodeURIComponent(player.name);

  return player.platform === "lichess"
    ? `https://lichess.org/@/${username}`
    : `https://www.chess.com/member/${username}`;
}

function getCooldownKey(platform: Platform, name: string): string {
  return `${platform}:${name.trim().toLocaleLowerCase("tr")}`;
}

function formatRemainingTime(milliseconds: number): string {
  return `${Math.ceil(milliseconds / 1000)} saniye`;
}

export default function Page() {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("lichess");
  const [timeControl, setTimeControl] = useState<TimeControl>("3+0");
  const [players, setPlayers] = useState<Player[]>([]);
  const [adminMode, setAdminMode] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldowns, setCooldowns] = useState<Cooldowns>({});
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOLDOWN_STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as Cooldowns;
        const now = Date.now();

        const activeCooldowns = Object.fromEntries(
          Object.entries(parsed).filter(
            ([, expiresAt]) =>
              typeof expiresAt === "number" && expiresAt > now
          )
        );

        setCooldowns(activeCooldowns);
        localStorage.setItem(
          COOLDOWN_STORAGE_KEY,
          JSON.stringify(activeCooldowns)
        );
      }
    } catch {
      setNotice("Bekleme süresi bilgileri okunamadı.");
    }
  }, []);

  async function toggleAdmin() {
    if (adminMode) {
      await supabase.auth.signOut();
      setAdminMode(false);
      setNotice("Yönetici oturumu kapatıldı.");
      return;
    }

    setAdminModal(true);
    setNotice("");
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setNotice("E-posta ve şifreni gir.");
      return;
    }

    setAdminLoading(true);
    setNotice("");

    try {
      // Önce Supabase e-posta ve şifre doğrulaması yapılır.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setNotice("Giriş başarısız. E-posta veya şifreni kontrol et.");
        return;
      }

      // Kullanıcının ID'si queue_admins tablosunda aranır.
      const { data: admin, error: adminError } = await supabase
        .from("queue_admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError) {
        await supabase.auth.signOut();
        console.error("Yönetici kontrol hatası:", adminError);
        setNotice(
          "Yönetici yetkisi kontrol edilemedi. Supabase tablo izinlerini (RLS) kontrol et."
        );
        return;
      }

      if (!admin) {
        await supabase.auth.signOut();
        setNotice(
          "Bu hesap yönetici olarak yetkilendirilmemiş. queue_admins tablosunu kontrol et."
        );
        return;
      }

      setAdminMode(true);
      setAdminModal(false);
      setPassword("");
      setNotice("Yönetici girişi başarılı.");
    } catch (error) {
      console.error("Yönetici giriş hatası:", error);
      setNotice("Giriş sırasında bir hata oluştu. Tekrar dene.");
    } finally {
      setAdminLoading(false);
    }
  }

  function joinQueue() {
    const cleanName = name.trim();

    if (!cleanName) {
      setNotice("Lütfen satranç kullanıcı adını gir.");
      return;
    }

    if (/\s/.test(cleanName)) {
      setNotice("Kullanıcı adında boşluk kullanma.");
      return;
    }

    const alreadyJoined = players.some(
      (player) =>
        player.platform === platform &&
        player.name.toLocaleLowerCase("tr") ===
          cleanName.toLocaleLowerCase("tr")
    );

    if (alreadyJoined) {
      setNotice("Bu kullanıcı adı seçilen platformda zaten sırada.");
      return;
    }

    const cooldownKey = getCooldownKey(platform, cleanName);
    const remaining = (cooldowns[cooldownKey] ?? 0) - Date.now();

    if (remaining > 0) {
      setNotice(
        `Tekrar sıraya katılmak için ${formatRemainingTime(remaining)} beklemelisin.`
      );
      return;
    }

    const newPlayer: Player = {
      id: Date.now(),
      name: cleanName,
      platform,
      timeControl,
    };

    const nextCooldowns: Cooldowns = {
      ...cooldowns,
      [cooldownKey]: Date.now() + COOLDOWN_MS,
    };

    setPlayers((current) => [...current, newPlayer]);
    setCooldowns(nextCooldowns);

    try {
      localStorage.setItem(
        COOLDOWN_STORAGE_KEY,
        JSON.stringify(nextCooldowns)
      );
    } catch {
      // Depolama kullanılamazsa bekleme süresi bu oturumda uygulanır.
    }

    setName("");
    setNotice(
      `${cleanName}, ${platform === "lichess" ? "Lichess" : "Chess.com"} üzerinden ${timeControl} süresiyle sıraya katıldı. Aynı kullanıcı adıyla tekrar katılmak için 1 dakika beklemelisin.`
    );
  }

  function removePlayer(id: number) {
    if (!adminMode) return;
    setPlayers((current) => current.filter((player) => player.id !== id));
  }

  function movePlayer(id: number, direction: -1 | 1) {
    if (!adminMode) return;

    setPlayers((current) => {
      const index = current.findIndex((player) => player.id === id);
      const nextIndex = index + direction;

      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const updated = [...current];
      [updated[index], updated[nextIndex]] = [
        updated[nextIndex],
        updated[index],
      ];

      return updated;
    });
  }

  return (
    <main className="site-shell">
      <div className="ambient" aria-hidden="true" />

      <header className="topbar">
        <a href="/" className="brand" aria-label="SolbekErsin ana sayfa">
          <img
            src="/logo.png"
            alt="SolbekErsin"
            width={36}
            height={36}
            style={{
              width: 36,
              height: 36,
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
          <span>SolbekErsin</span>
        </a>

        <button
          type="button"
          className="admin-toggle"
          onClick={toggleAdmin}
        >
          {adminMode ? "Yönetici oturumunu kapat" : "Yönetici"}
        </button>
      </header>

      {adminModal && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setAdminModal(false);
              setNotice("");
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0,0,0,0.72)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
            className="panel"
            style={{ width: "100%", maxWidth: 420, padding: 28 }}
          >
            <p className="section-label">YETKİLİ ERİŞİMİ</p>
            <h2 id="admin-login-title">Yönetici girişi</h2>
            <p className="panel-description">
              Supabase hesabının e-posta adresini ve şifresini gir.
            </p>

            <form className="join-form" onSubmit={loginAdmin}>
              <label htmlFor="admin-email">E-posta</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-posta adresin"
              />

              <label htmlFor="admin-password">Şifre</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifren"
              />

              <button
                type="submit"
                className="primary-button"
                disabled={adminLoading}
              >
                {adminLoading ? "Kontrol ediliyor..." : "Giriş yap"}
              </button>

              <button
                type="button"
                className="admin-toggle"
                onClick={() => {
                  setAdminModal(false);
                  setPassword("");
                  setNotice("");
                }}
              >
                Vazgeç
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" />
            SATRANÇ TOPLULUĞU
          </p>

          <h1>
            Sıranı al,
            <br />
            <span>oyuna katıl.</span>
          </h1>

          <p className="hero-description">
            Satranç platformunu seç, kullanıcı adını ekle ve oyun süreni
            belirleyerek sıranı takip et.
          </p>
        </div>
      </section>

      <section className="main-grid">
        <div className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">CANLI LİSTE</p>
              <h2>Oyun sırası</h2>
            </div>
            <span className="queue-count">{players.length} kişi</span>
          </div>

          {players.length === 0 ? (
            <div className="empty-state">
              <p>Henüz sırada kimse yok.</p>
              <span>İlk katılan sen ol!</span>
            </div>
          ) : (
            <ol className="player-list">
              {players.map((player, index) => (
                <li className="player-item" key={player.id}>
                  <span className="player-position">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="player-details">
                    <a
                      className="player-name player-profile-link"
                      href={getProfileUrl(player)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${player.name} adlı oyuncunun profilini aç`}
                    >
                      <span>{player.name}</span>
                      <span className="profile-link-icon" aria-hidden="true">
                        ↗
                      </span>
                    </a>

                    <div className="player-meta">
                      <span className="player-platform">
                        {player.platform === "lichess"
                          ? "Lichess"
                          : "Chess.com"}
                      </span>
                      <span className="player-time">{player.timeControl}</span>
                    </div>
                  </div>

                  {adminMode && (
                    <div className="player-actions">
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => movePlayer(player.id, -1)}
                        disabled={index === 0}
                        aria-label="Sırada yukarı taşı"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => movePlayer(player.id, 1)}
                        disabled={index === players.length - 1}
                        aria-label="Sırada aşağı taşı"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removePlayer(player.id)}
                        aria-label="Sıradan çıkar"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="queue-footer">
            Oyuncunun ismine tıklayarak satranç profilini yeni sekmede açabilirsin.
          </div>
        </div>

        <div className="panel join-panel">
          <p className="section-label">HAZIR MISIN?</p>
          <h2>Sıraya katıl</h2>
          <p className="panel-description">
            Platformunu seç, kullanıcı adını ve oyun süreni gir.
          </p>

          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              joinQueue();
            }}
          >
            <label htmlFor="platform">Satranç platformu</label>
            <select
              id="platform"
              className="time-control-select"
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value as Platform)
              }
            >
              <option value="lichess">Lichess</option>
              <option value="chess.com">Chess.com</option>
            </select>

            <label htmlFor="player-name">Kullanıcı adın</label>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Satranç kullanıcı adın..."
              maxLength={40}
              autoComplete="off"
            />

            <label htmlFor="time-control" className="time-control-label">
              Blitz oyun süresi
            </label>
            <select
              id="time-control"
              className="time-control-select"
              value={timeControl}
              onChange={(event) =>
                setTimeControl(event.target.value as TimeControl)
              }
            >
              {timeControls.map((control) => (
                <option key={control.value} value={control.value}>
                  {control.label}
                </option>
              ))}
            </select>

            <button type="submit" className="primary-button">
              Sıraya katıl <span aria-hidden="true">→</span>
            </button>
          </form>

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}

          {adminMode && (
            <p className="admin-notice">
              Yönetici modu açık. Oyuncuları taşıyabilir veya sıradan
              çıkarabilirsin.
            </p>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <span>© SolbekErsin</span>
        <span>Satranç topluluğu</span>
      </footer>
    </main>
  );
}
