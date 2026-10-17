
"use client";

import { useState } from "react";

type Player = {
  id: number;
  name: string;
};

export default function Page() {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [adminMode, setAdminMode] = useState(false);
  const [notice, setNotice] = useState("");

  function joinQueue() {
    const cleanName = name.trim();

    if (!cleanName) {
      setNotice("Lütfen ismini gir.");
      return;
    }

    const alreadyJoined = players.some(
      (player) =>
        player.name.toLocaleLowerCase("tr") ===
        cleanName.toLocaleLowerCase("tr")
    );

    if (alreadyJoined) {
      setNotice("Bu isim zaten sırada.");
      return;
    }

    setPlayers((current) => [
      ...current,
      { id: Date.now(), name: cleanName },
    ]);

    setName("");
    setNotice("Sıraya başarıyla katıldın.");
  }

  function removePlayer(id: number) {
    setPlayers((current) => current.filter((player) => player.id !== id));
  }

  function movePlayer(id: number, direction: -1 | 1) {
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

  function toggleAdmin() {
    if (adminMode) {
      setAdminMode(false);
      setNotice("Yönetici modu kapatıldı.");
      return;
    }

    const password = window.prompt("Yönetici şifresini gir:");

    if (password === null) return;

    if (password !== "admin123") {
      setNotice("Şifre hatalı.");
      return;
    }

    setAdminMode(true);
    setNotice("Yönetici modu açıldı.");
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
          {adminMode ? "Yönetici modunu kapat" : "Yönetici"}
        </button>
      </header>

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
            Satranç oyun sırasına katıl, sıranı takip et ve oyun zamanı
            geldiğinde hazır ol.
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

                  <span className="player-name">{player.name}</span>

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
            Sıra, katılım sırasına göre düzenlenir.
          </div>
        </div>

        <div className="panel join-panel">
          <p className="section-label">HAZIR MISIN?</p>
          <h2>Sıraya katıl</h2>

          <p className="panel-description">
            İsmini yaz ve oyun sırasındaki yerini al.
          </p>

          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              joinQueue();
            }}
          >
            <label htmlFor="player-name">Adın</label>

            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="İsmini yaz..."
              maxLength={40}
              autoComplete="name"
            />

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
