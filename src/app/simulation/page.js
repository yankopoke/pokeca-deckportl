'use client';

import { useEffect, useRef, Suspense } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import './simulation.css';

function SimulationContent() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    function handleResize() {
      if (typeof window !== 'undefined') {
        const targetWidth = 2750; // Expected overall width including margins
        const scale = Math.min(1, window.innerWidth / targetWidth);
        // Use zoom instead of transform: scale to preserve drag/drop coordinate offsets
        document.body.style.zoom = scale;
      }
    }
    
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        document.body.style.zoom = 1;
      };
    }
  }, []);

  const handleScriptsLoaded = () => {
    if (initialized.current) return;
    if (typeof window === 'undefined' || !window.Sortable) return;
    initialized.current = true;

    const getEl = (id) => document.getElementById(id);

    // Shuffle utility
    const shuffle = (array) => {
      let i = array.length;
      while (i) { let j = Math.floor(Math.random() * i); let t = array[--i]; array[i] = array[j]; array[j] = t; }
      return array;
    };
    if (!Array.prototype.shuffle) {
      Array.prototype.shuffle = function() { return shuffle(this); };
    }

    function init(player, deck) {
      const dw = getEl(`${player}_deck_wrap`);
      const hw = getEl(`${player}_hand_wrap`);
      const sw = getEl(`${player}_side_wrap`);
      const tw = getEl(`${player}_trash_wrap`);
      if (!dw || !deck) return;
      dw.innerHTML = ""; hw.innerHTML = ""; sw.innerHTML = ""; tw.innerHTML = "";
      
      const shuffled = [...deck].shuffle();
      shuffled.forEach((card, i) => {
        const li = document.createElement("li");
        li.id = `${player}_card_${card.id}_${i}`;
        li.className = "card";
        const img = document.createElement("img");
        img.src = card.url; img.alt = card.name;
        li.appendChild(img);
        li.onclick = () => { li.classList.toggle("checked"); };
        dw.appendChild(li);

        li.oncontextmenu = (e) => {
          e.preventDefault();
          const menu = getEl('contextmenu');
          menu.style.display = "block";
          menu.style.top = `${e.clientY}px`;
          menu.style.left = `${e.clientX}px`;
          getEl("retuen_to_deck").onclick = () => { dw.appendChild(li); const nodes = Array.from(dw.children).shuffle(); dw.innerHTML = ""; nodes.forEach(n => dw.appendChild(n)); menu.style.display = "none"; };
          getEl("move_to_trash").onclick = () => { tw.appendChild(li); menu.style.display = "none"; };
          getEl("reverse_card").onclick = () => { li.classList.toggle("hide"); menu.style.display = "none"; };
          getEl("move_to_hand").onclick = () => { hw.appendChild(li); li.classList.remove("hide"); menu.style.display = "none"; };
          getEl("move_to_top").onclick = () => { dw.insertBefore(li, dw.firstChild); menu.style.display = "none"; };
          getEl("move_to_bottom").onclick = () => { dw.appendChild(li); menu.style.display = "none"; };
        };
      });
    }

    function setupInitialState(player) {
      const dw = getEl(`${player}_deck_wrap`);
      const hw = getEl(`${player}_hand_wrap`);
      const sw = getEl(`${player}_side_wrap`);
      for (let j = 0; j < 7; j++) if (dw && dw.firstElementChild) hw.appendChild(dw.firstElementChild);
      for (let j = 0; j < 6; j++) {
        if (dw && dw.firstElementChild) { const c = dw.firstElementChild; c.classList.add("hide"); sw.appendChild(c); }
      }
    }

    // Deck load from code
    const setBtn = getEl("set-btn");
    setBtn.onclick = async () => {
      const cid1 = getEl("left_code").value.trim();
      const cid2 = getEl("right_code").value.trim();
      if (!cid1) return;
      document.querySelector(".loading").classList.remove("is-hide");
      try {
        let p1Deck = [];
        if (cid1 === "maggyo") {
          p1Deck = [
            { id: "01", name: "MaggyoV", url: "https://www.pokemon-card.com/assets/images/card_images/large/S2a/038117_P_GARARUMAGGYOV.jpg" },
            { id: "02", name: "ZashianV", url: "https://www.pokemon-card.com/assets/images/card_images/large/S1W/037656_P_ZASHIANV.jpg" },
            ...Array(58).fill({ id: "99", name: "Energy", url: "https://www.pokemon-card.com/assets/images/card_images/large/S11/100100_E_KIHONHAGANEENERGY.jpg" })
          ];
        } else {
          const data = await apiClient.fetchProxy(cid1);
          if (Array.isArray(data) && data.length > 0) p1Deck = data;
          else { alert("P1: デッキが見つかりませんでした"); return; }
        }
        init("p1", p1Deck);
        setupInitialState("p1");

        if (cid2) {
          let p2Deck = [];
          if (cid2 === "maggyo") { p2Deck = p1Deck; }
          else {
            const data2 = await apiClient.fetchProxy(cid2);
            if (Array.isArray(data2) && data2.length > 0) p2Deck = data2;
          }
          if (p2Deck.length > 0) { init("p2", p2Deck); setupInitialState("p2"); }
        }
      } catch (e) { console.error(e); alert("エラーが発生しました"); }
      finally { document.querySelector(".loading").classList.add("is-hide"); }
    };

    // Support Saved Decks from LocalStorage
    const loadSavedDeck = (deckId, player) => {
      const stored = localStorage.getItem('pokeca_decks');
      if (!stored) return;
      try {
        const savedDecks = JSON.parse(stored);
        const target = savedDecks.find(d => d.id === deckId);
        if (target) {
          const flatDeck = [];
          target.cards.forEach(card => {
            for (let i = 0; i < card.count; i++) {
              flatDeck.push({
                id: card.id,
                name: card.name || "",
                url: card.imageUrl
              });
            }
          });
          init(player, flatDeck);
          setupInitialState(player);
        }
      } catch (err) {
        console.error("Failed to load saved deck", err);
      }
    };

    const leftSaved = getEl("left_saved_deck");
    const rightSaved = getEl("right_saved_deck");
    
    const populateSavedDecks = () => {
      const stored = localStorage.getItem('pokeca_decks');
      if (stored) {
        try {
          const savedDecks = JSON.parse(stored);
          const options = savedDecks.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
          const placeholder = '<option value="">保存済みデッキから選択</option>';
          if (leftSaved) leftSaved.innerHTML = placeholder + options;
          if (rightSaved) rightSaved.innerHTML = placeholder + options;
        } catch (e) {}
      }
    };
    populateSavedDecks();

    if (leftSaved) leftSaved.onchange = (e) => { if(e.target.value) loadSavedDeck(e.target.value, "p1"); };
    if (rightSaved) rightSaved.onchange = (e) => { if(e.target.value) loadSavedDeck(e.target.value, "p2"); };

    // Zone controls for each player
    ["p1", "p2"].forEach(p => {
      // Draw, shuffle, deck view
      getEl(`${p}_draw_btn`).onclick = () => { const dw = getEl(`${p}_deck_wrap`); const hw = getEl(`${p}_hand_wrap`); if (dw && dw.firstElementChild) hw.appendChild(dw.firstElementChild); };
      getEl(`${p}_shuffle_btn`).onclick = () => { const dw = getEl(`${p}_deck_wrap`); const nodes = Array.from(dw.children).shuffle(); dw.innerHTML = ""; nodes.forEach(n => dw.appendChild(n)); };
      getEl(`${p}_deck_btn`).onclick = () => {
        const dl = getEl(`${p}_deck`);
        const dw = getEl(`${p}_deck_wrap`);
        dl.style.display = dl.style.display === "none" ? "block" : "none";
        getEl(`${p}_deck_btn`).value = dl.style.display === "none" ? "デッキを見る" : "デッキを閉じる";
        // デッキを見るときは全カードを表向きに
        if (dl.style.display !== "none") {
          Array.from(dw.children).forEach(c => c.classList.remove("hide"));
        }
      };

      // Side buttons
      getEl(`${p}_side_open`).onclick = () => { const sw = getEl(`${p}_side_wrap`); Array.from(sw.children).forEach(c => c.classList.remove("hide")); };
      // Side shuffle
      const sideShuffle = getEl(`${p}_side_shuffle`);
      if (sideShuffle) sideShuffle.onclick = () => { const sw = getEl(`${p}_side_wrap`); const nodes = Array.from(sw.children).shuffle(); sw.innerHTML = ""; nodes.forEach(n => sw.appendChild(n)); };
      // Side get N cards
      [1,2,3].forEach(n => {
        const btn = getEl(`${p}_side_get${n}`);
        if (btn) btn.onclick = () => {
          const sw = getEl(`${p}_side_wrap`); const hw = getEl(`${p}_hand_wrap`);
          for (let i = 0; i < n; i++) { if (sw.firstElementChild) { const c = sw.firstElementChild; c.classList.remove("hide"); hw.appendChild(c); } }
        };
      });

      // Battle zone buttons
      const battleToDeck = getEl(`${p}_battle_to_deck`);
      if (battleToDeck) battleToDeck.onclick = () => {
        const bw = getEl(`${p}_battle_wrap`); const dw = getEl(`${p}_deck_wrap`);
        Array.from(bw.children).forEach(c => { c.classList.remove("hide"); dw.appendChild(c); });
        const nodes = Array.from(dw.children).shuffle(); dw.innerHTML = ""; nodes.forEach(n => dw.appendChild(n));
        const input = getEl(`${p}_battle_damage_box`); if (input) input.value = "0";
      };
      const battleTrash = getEl(`${p}_battle_trash`);
      if (battleTrash) battleTrash.onclick = () => {
        const bw = getEl(`${p}_battle_wrap`); const tw = getEl(`${p}_trash_wrap`);
        Array.from(bw.children).forEach(c => { c.classList.remove("hide"); tw.appendChild(c); });
        const input = getEl(`${p}_battle_damage_box`); if (input) input.value = "0";
      };

      // Bench buttons (バトル場 / トラッシュ)
      [1,2,3,4,5,6,7,8].forEach(n => {
        const toBattle = getEl(`${p}_b${n}_battle`);
        if (toBattle) toBattle.onclick = () => {
          const benchWrap = getEl(`${p}_bench${n}_wrap`); const battleWrap = getEl(`${p}_battle_wrap`);
          const benchDmg = getEl(`${p}_bench${n}_damage_box`);
          const battleDmg = getEl(`${p}_battle_damage_box`);
          // Save current cards and damage
          const battleCards = Array.from(battleWrap.children);
          const benchCards = Array.from(benchWrap.children);
          const oldBattleDmg = battleDmg ? battleDmg.value : "0";
          const oldBenchDmg = benchDmg ? benchDmg.value : "0";
          // Move battle cards to bench
          battleCards.forEach(c => benchWrap.appendChild(c));
          // Move bench cards to battle
          benchCards.forEach(c => battleWrap.appendChild(c));
          // Swap damage values
          if (battleDmg) battleDmg.value = oldBenchDmg;
          if (benchDmg) benchDmg.value = oldBattleDmg;
        };
        const toTrash = getEl(`${p}_b${n}_trash`);
        if (toTrash) toTrash.onclick = () => {
          const benchWrap = getEl(`${p}_bench${n}_wrap`); const tw = getEl(`${p}_trash_wrap`);
          Array.from(benchWrap.children).forEach(c => tw.appendChild(c));
          const input = getEl(`${p}_bench${n}_damage_box`); if (input) input.value = "0";
        };
      });

      // Damage
      ["battle","bench1","bench2","bench3","bench4","bench5","bench6","bench7","bench8"].forEach(z => {
        const input = getEl(`${p}_${z}_damage_box`);
        const up = getEl(`${p}_${z}_damage_box_up`);
        const down = getEl(`${p}_${z}_damage_box_down`);
        const up50 = getEl(`${p}_${z}_damage_box_up50`);
        const up100 = getEl(`${p}_${z}_damage_box_up100`);
        if (up && down && input) {
          up.onclick = (e) => { e.preventDefault(); input.value = (parseInt(input.value) || 0) + 10; };
          down.onclick = (e) => { e.preventDefault(); input.value = Math.max(0, (parseInt(input.value) || 0) - 10); };
          if (up50) up50.onclick = (e) => { e.preventDefault(); input.value = (parseInt(input.value) || 0) + 50; };
          if (up100) up100.onclick = (e) => { e.preventDefault(); input.value = (parseInt(input.value) || 0) + 100; };
        }
      });

      // Status conditions
      ["burn","poison","sleeping","paralysis","confusion"].forEach(s => {
        const btn = getEl(`${p}_${s}`);
        if (btn) btn.onclick = () => {
          btn.classList.toggle("on");
          const bg = getEl(`${p}_battle_bg`);
          if (bg) {
            if (btn.classList.contains("on")) bg.style.backgroundColor = getComputedStyle(btn).backgroundColor;
            else { const activeBtn = document.querySelector(`#${p}_battle .btn01.on`); bg.style.backgroundColor = activeBtn ? getComputedStyle(activeBtn).backgroundColor : "transparent"; }
          }
        };
      });

      // Counters
      [["deck_wrap","deck_remaining"],["hand_wrap","hand_remaining"],["trash_wrap","trash_remaining"],["lostzone_wrap","lostzone_remaining"]].forEach(([w,c]) => {
        const wrap = getEl(`${p}_${w}`);
        const counter = getEl(`${p}_${c}`);
        if (wrap && counter) {
          const obs = new MutationObserver(() => { counter.innerText = wrap.childElementCount; });
          obs.observe(wrap, { childList: true });
          counter.innerText = wrap.childElementCount;
        }
      });

      // Reset (per-player: collect all cards back to deck, reshuffle, redeal)
      const resetBtn = getEl(`${p}_reset`);
      if (resetBtn) resetBtn.onclick = () => {
        const dw = getEl(`${p}_deck_wrap`);
        const hw = getEl(`${p}_hand_wrap`);
        const sw = getEl(`${p}_side_wrap`);
        const tw = getEl(`${p}_trash_wrap`);
        const bw = getEl(`${p}_battle_wrap`);
        const lz = getEl(`${p}_lostzone_wrap`);
        // Collect cards from all zones back to deck
        [hw, sw, tw, bw, lz].forEach(zone => {
          if (zone) Array.from(zone.children).forEach(c => { c.classList.remove("hide", "checked"); dw.appendChild(c); });
        });
        // Also check stadium for this player's cards
        const stadiumWrap = getEl("stadium_wrap");
        if (stadiumWrap) {
          Array.from(stadiumWrap.children).forEach(c => {
            if (c.id.startsWith(p)) {
              c.classList.remove("hide", "checked");
              dw.appendChild(c);
            }
          });
        }
        [1,2,3,4,5,6,7,8].forEach(n => {
          const benchWrap = getEl(`${p}_bench${n}_wrap`);
          if (benchWrap) Array.from(benchWrap.children).forEach(c => { c.classList.remove("hide", "checked"); dw.appendChild(c); });
          const benchDmg = getEl(`${p}_bench${n}_damage_box`);
          if (benchDmg) benchDmg.value = "0";
        });
        // Reset battle damage
        const battleDmg = getEl(`${p}_battle_damage_box`);
        if (battleDmg) battleDmg.value = "0";
        // Reset status conditions
        ["burn","poison","sleeping","paralysis","confusion"].forEach(s => {
          const btn = getEl(`${p}_${s}`);
          if (btn) btn.classList.remove("on");
        });
        const bg = getEl(`${p}_battle_bg`);
        if (bg) bg.style.backgroundColor = "transparent";
        // Shuffle deck
        const nodes = Array.from(dw.children).shuffle();
        dw.innerHTML = "";
        nodes.forEach(n => dw.appendChild(n));
        // Redeal initial state
        setupInitialState(p);
      };

      // LostZone toggle
      const lzBtn = getEl(`${p}_lostzone_btn`);
      if (lzBtn) lzBtn.onclick = () => {
        const lz = getEl(`${p}_lostzone`);
        if (lz) lz.style.display = lz.style.display === "none" ? "block" : "none";
      };

      // Hand operations
      const handTrash = getEl(`${p}_hand_trash`);
      if (handTrash) handTrash.onclick = () => {
        const hw = getEl(`${p}_hand_wrap`);
        const tw = getEl(`${p}_trash_wrap`);
        Array.from(hw.children).forEach(c => { c.classList.remove("checked"); tw.appendChild(c); });
      };
      const handToDeck = getEl(`${p}_hand_to_deck`);
      if (handToDeck) handToDeck.onclick = () => {
        const hw = getEl(`${p}_hand_wrap`);
        const dw = getEl(`${p}_deck_wrap`);
        Array.from(hw.children).forEach(c => { c.classList.remove("checked"); dw.appendChild(c); });
        const nodes = Array.from(dw.children).shuffle();
        dw.innerHTML = "";
        nodes.forEach(n => dw.appendChild(n));
      };
      // Hand to deck bottom
      const handToDeckBottom = getEl(`${p}_hand_to_deck_bottom`);
      if (handToDeckBottom) handToDeckBottom.onclick = () => {
        const hw = getEl(`${p}_hand_wrap`);
        const dw = getEl(`${p}_deck_wrap`);
        Array.from(hw.children).forEach(c => { c.classList.remove("checked"); dw.appendChild(c); });
      };
      // Mugen zone (bench+)
      const mugenBtn = getEl(`${p}_mugen_zone`);
      if (mugenBtn) mugenBtn.onclick = () => {
        [6,7,8].forEach(n => {
          const bench = getEl(`${p}_bench${n}`);
          if (bench) bench.style.display = bench.style.display === "none" ? "" : "none";
        });
      };
      // Deck top 5
      const deck5Btn = getEl(`${p}_deck_5`);
      if (deck5Btn) deck5Btn.onclick = () => {
        const dl = getEl(`${p}_deck`);
        const dw = getEl(`${p}_deck_wrap`);
        dl.style.display = "block";
        getEl(`${p}_deck_btn`).value = "デッキを閉じる";
        // Show only top 5 face-up, rest face-down
        Array.from(dw.children).forEach((c, i) => {
          if (i < 5) c.classList.remove("hide");
          else c.classList.add("hide");
        });
      };
    });

    // Sortable
    const sortZones = [
      "p1_side_wrap","p1_battle_wrap","p1_hand_wrap","p1_trash_wrap","p1_deck_wrap","p1_lostzone_wrap",
      "p2_side_wrap","p2_battle_wrap","p2_hand_wrap","p2_trash_wrap","p2_deck_wrap","p2_lostzone_wrap",
    ];
    [1,2,3,4,5,6,7,8].forEach(n => { sortZones.push(`p1_bench${n}_wrap`); sortZones.push(`p2_bench${n}_wrap`); });
    sortZones.forEach(id => {
      const el = getEl(id);
      if (el && window.Sortable) {
        window.Sortable.create(el, { group: id.startsWith("p1") ? "p1" : "p2", animation: 100 });
      }
    });
    // Stadium accepts cards from both P1 and P2
    const stadiumEl = getEl("stadium_wrap");
    if (stadiumEl && window.Sortable) {
      window.Sortable.create(stadiumEl, {
        group: { name: "stadium", put: ["p1", "p2"] },
        animation: 100,
        onAdd: function (evt) {
          // Move other cards in stadium to their owner's trash
          const item = evt.item;
          const parent = evt.to;
          Array.from(parent.children).forEach(c => {
            if (c !== item) {
              const owner = c.id.startsWith("p1") ? "p1" : "p2";
              const tw = getEl(`${owner}_trash_wrap`);
              if (tw) {
                c.classList.remove("hide", "checked");
                tw.appendChild(c);
              }
            }
          });
        }
      });
    }

    // Coin
    getEl("coin").onclick = async function() {
      for (let i = 0; i < 6; i++) {
        this.src = this.src.includes("coin.png") ? "https://funamushi.net/pokeca_hitorimawashi/img/coin_bk.png" : "https://funamushi.net/pokeca_hitorimawashi/img/coin.png";
        await new Promise(r => setTimeout(r, 100));
      }
      this.src = Math.random() > 0.5 ? "https://funamushi.net/pokeca_hitorimawashi/img/coin.png" : "https://funamushi.net/pokeca_hitorimawashi/img/coin_bk.png";
    };

    // Dark mode
    getEl("darkmode_button").onclick = () => document.body.classList.toggle("dark");

    // Stadium trash
    const stadiumTrash = getEl("stadium_trash");
    if (stadiumTrash) stadiumTrash.onclick = () => {
      const sw = getEl("stadium_wrap");
      Array.from(sw.children).forEach(c => {
        const owner = c.id.startsWith("p1") ? "p1" : "p2";
        const tw = getEl(`${owner}_trash_wrap`);
        if (tw) {
          c.classList.remove("hide", "checked");
          tw.appendChild(c);
        }
      });
    };

    // Context menu close
    document.addEventListener('click', (e) => {
      const menu = getEl('contextmenu');
      if (menu && !menu.contains(e.target)) menu.style.display = "none";
    });

    // VSTAR markers
    ["p1_Vstar","p2_Vstar"].forEach(id => {
      const el = getEl(id);
      if (el) el.onclick = () => el.classList.toggle("on");
    });

    // Auto load from URL or LocalStorage
    const source = searchParams.get('source');
    const code = searchParams.get('code');
    
    if (source === 'local') {
      const localData = localStorage.getItem('pokeca_preview_deck');
      if (localData) {
        try {
          const p1Deck = JSON.parse(localData);
          init("p1", p1Deck);
          setupInitialState("p1");
        } catch (e) {
          console.error("Failed to load local deck", e);
        }
      }
    } else if (code) {
      getEl("left_code").value = code;
      setBtn.click();
    }
  };

  const BenchArea = ({ p, n }) => (
    <div id={`${p}_bench${n}`} className="benchArea boxLayout01" style={n > 5 ? {display:'none'} : {}}>
      <p className="boxTitle">bench {n}
        <input id={`${p}_bench${n}_damage_box`} type="tel" name="num" className="damageBox" defaultValue="0" />
        <a id={`${p}_bench${n}_damage_box_up`} className="btn01">▲</a>
        <a id={`${p}_bench${n}_damage_box_down`} className="btn01">▼</a>
        <a id={`${p}_bench${n}_damage_box_up50`} className="btn01">+50</a>
        <a id={`${p}_bench${n}_damage_box_up100`} className="btn01">+100</a>
      </p>
      <div id={`${p}_bench${n}_bg`} className="bgLayout"></div>
      <div className="btnWrap">
        <a id={`${p}_b${n}_battle`} className="btn01">バトル場</a>
        <a id={`${p}_b${n}_trash`} className="btn01">トラッシュ</a>
      </div>
      <ul id={`${p}_bench${n}_wrap`} className="cardWrap"></ul>
    </div>
  );

  const P1Area = () => (
    <div className="fieldArea" onContextMenu={(e) => e.preventDefault()}>
      <div style={{position:'absolute'}}>
        <a id="go_to_blog" className="btn01" href="/" style={{marginTop:10,textDecoration:'none'}}>ホームに戻る</a>
      </div>
      <div style={{position:'absolute',marginTop:40}}>
        <a id="darkmode_button" className="btn01" style={{marginTop:10,textDecoration:'none'}}>ダークモード切り替え</a>
      </div>

      {/* Side */}
      <div id="p1_side" className="sideWrap">
        <div className="sideArea boxLayout01">
          <div className="boxTitle">side
            <div className="btnWrap">
              <a id="p1_side_open" className="btn01">表にする</a>
              <a id="p1_side_shuffle" className="btn01">シャッフル</a>
              <a id="p1_side_get1" className="btn01">1枚とる</a>
              <a id="p1_side_get2" className="btn01">2枚とる</a>
              <a id="p1_side_get3" className="btn01">3枚とる</a>
            </div>
          </div>
          <ul id="p1_side_wrap" className="cardWrap"></ul>
        </div>
        <div id="p1_Vstar" className="vstarMark">V<span>star</span></div>
      </div>

      {/* Battle */}
      <div className="battleWrap">
        <div id="p1_battle" className="battleArea boxLayout01">
          <div id="p1_battle_bg" className="bgLayout"></div>
          <div className="boxTitle">battle
            <div className="btnWrap">
              <a id="p1_burn" className="btn01 burn">やけど</a>
              <a id="p1_poison" className="btn01 poison">どく</a>
              <a id="p1_sleeping" className="btn01 sleeping">ねむり</a>
              <a id="p1_paralysis" className="btn01 paralysis">まひ</a>
              <a id="p1_confusion" className="btn01 confusion">こんらん</a>
            </div>
          </div>
          <div className="btnWrap alR">
            <input id="p1_battle_damage_box" type="tel" name="num" className="damageBox" defaultValue="0" />
            <a id="p1_battle_damage_box_up" className="btn01">▲</a>
            <a id="p1_battle_damage_box_down" className="btn01">▼</a>
            <a id="p1_battle_damage_box_up50" className="btn01">+50</a>
            <a id="p1_battle_damage_box_up100" className="btn01">+100</a>
            <a id="p1_battle_to_deck" className="btn01">デッキ戻し</a>
            <a id="p1_battle_trash" className="btn01">トラッシュ</a>
          </div>
          <ul id="p1_battle_wrap" className="cardWrap"></ul>
        </div>
        <div id="p1_lostzone" className="lostArea boxLayout01" style={{display:'none'}}>
          <div className="boxTitle">lost(<span id="p1_lostzone_remaining">0</span>)</div>
          <ul id="p1_lostzone_wrap" className="cardWrap"></ul>
        </div>
      </div>

      {/* Bench */}
      <div id="p1_bench" className="benchWrap">
        {[1,2,3,4,5,6,7,8].map(n => <BenchArea key={n} p="p1" n={n} />)}
      </div>

      {/* Hand + Trash + Deck */}
      <div id="p1_hand" className="colLayout01">
        <div className="handWrap">
          <div className="handArea boxLayout01">
            <div className="boxTitle">hand(<span id="p1_hand_remaining">0</span>)
              <a id="p1_mugen_zone" className="btn01" style={{marginLeft:10}}>ベンチ+</a>
            </div>
            <div className="btnWrap">
              <a id="p1_hand_trash" className="btn01">トラッシュ</a>
              <a id="p1_hand_to_deck" className="btn01">デッキ戻し</a>
              <a id="p1_hand_to_deck_bottom" className="btn01">デッキ下</a>
            </div>
            <ul id="p1_hand_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div id="p1_trash" className="trashWrap">
          <div className="trashArea boxLayout01">
            <div className="boxTitle">trash(<span id="p1_trash_remaining">0</span>)</div>
            <div className="btnWrap">
              <a id="p1_lostzone_btn" className="btn01">ロストゾーン表示</a>
            </div>
            <ul id="p1_trash_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div className="deckWrap">
          <div className="deckArea boxLayout01">
            <div className="boxTitle">deck(<span id="p1_deck_remaining">0</span>)</div>
            <div>
              <input type="button" id="p1_draw_btn" value="1枚ドロー" className="btn02" />
              <input type="button" id="p1_shuffle_btn" value="シャッフル" className="btn02" />
              <input type="button" id="p1_deck_5" value="山上5枚見る" className="btn02" />
              <input type="button" id="p1_deck_btn" value="デッキを見る" className="btn02" />
            </div>
          </div>
        </div>
      </div>
      <div id="p1_deck" className="deckListWrap" style={{display:'none'}}>
        <div className="boxLayout01">
          <p className="boxTitle">deck</p>
          <ul id="p1_deck_wrap" className="cardWrap"></ul>
        </div>
      </div>
    </div>
  );

  const P2Area = () => (
    <div className="fieldArea" onContextMenu={(e) => e.preventDefault()}>
      {/* Side */}
      <div id="p2_side" className="sideWrap">
        <div id="p2_Vstar" className="vstarMark">V<span>star</span></div>
        <div className="sideArea boxLayout01">
          <div className="boxTitle">side
            <div className="btnWrap">
              <a id="p2_side_open" className="btn01">表にする</a>
              <a id="p2_side_shuffle" className="btn01">シャッフル</a>
              <a id="p2_side_get1" className="btn01">1枚とる</a>
              <a id="p2_side_get2" className="btn01">2枚とる</a>
              <a id="p2_side_get3" className="btn01">3枚とる</a>
            </div>
          </div>
          <ul id="p2_side_wrap" className="cardWrap"></ul>
        </div>
      </div>

      {/* Battle */}
      <div className="battleWrap">
        <div id="p2_lostzone" className="lostArea boxLayout01" style={{display:'none'}}>
          <div className="boxTitle">lost(<span id="p2_lostzone_remaining">0</span>)</div>
          <ul id="p2_lostzone_wrap" className="cardWrap"></ul>
        </div>
        <div id="p2_battle" className="battleArea boxLayout01">
          <div id="p2_battle_bg" className="bgLayout"></div>
          <div className="boxTitle">battle
            <div className="btnWrap">
              <a id="p2_burn" className="btn01 burn">やけど</a>
              <a id="p2_poison" className="btn01 poison">どく</a>
              <a id="p2_sleeping" className="btn01 sleeping">ねむり</a>
              <a id="p2_paralysis" className="btn01 paralysis">まひ</a>
              <a id="p2_confusion" className="btn01 confusion">こんらん</a>
            </div>
          </div>
          <div className="btnWrap alR">
            <input id="p2_battle_damage_box" type="tel" name="num" className="damageBox" defaultValue="0" />
            <a id="p2_battle_damage_box_up" className="btn01">▲</a>
            <a id="p2_battle_damage_box_down" className="btn01">▼</a>
            <a id="p2_battle_damage_box_up50" className="btn01">+50</a>
            <a id="p2_battle_damage_box_up100" className="btn01">+100</a>
            <a id="p2_battle_to_deck" className="btn01">デッキ戻し</a>
            <a id="p2_battle_trash" className="btn01">トラッシュ</a>
          </div>
          <ul id="p2_battle_wrap" className="cardWrap"></ul>
        </div>
      </div>

      {/* Bench */}
      <div id="p2_bench" className="benchWrap">
        {[1,2,3,4,5,6,7,8].map(n => <BenchArea key={n} p="p2" n={n} />)}
      </div>

      {/* Hand + Trash + Deck */}
      <div className="colLayout01">
        <div id="p2_hand" className="handWrap">
          <div className="handArea boxLayout01">
            <div className="boxTitle">hand(<span id="p2_hand_remaining">0</span>)
              <a id="p2_mugen_zone" className="btn01" style={{marginLeft:10}}>ベンチ+</a>
            </div>
            <div className="btnWrap">
              <a id="p2_hand_trash" className="btn01">トラッシュ</a>
              <a id="p2_hand_to_deck" className="btn01">デッキ戻し</a>
              <a id="p2_hand_to_deck_bottom" className="btn01">デッキ下</a>
            </div>
            <ul id="p2_hand_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div id="p2_trash" className="trashWrap">
          <div className="trashArea boxLayout01">
            <div className="boxTitle">trash(<span id="p2_trash_remaining">0</span>)</div>
            <div className="btnWrap">
              <a id="p2_lostzone_btn" className="btn01">ロストゾーン表示</a>
            </div>
            <ul id="p2_trash_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div className="deckWrap">
          <div className="deckArea boxLayout01">
            <div className="boxTitle">deck(<span id="p2_deck_remaining">0</span>)</div>
            <div>
              <input type="button" id="p2_draw_btn" value="1枚ドロー" className="btn02" />
              <input type="button" id="p2_shuffle_btn" value="シャッフル" className="btn02" />
              <input type="button" id="p2_deck_5" value="山上5枚見る" className="btn02" />
              <input type="button" id="p2_deck_btn" value="デッキを見る" className="btn02" />
            </div>
          </div>
        </div>
      </div>
      <div id="p2_deck" className="deckListWrap" style={{display:'none'}}>
        <div className="boxLayout01">
          <p className="boxTitle">deck</p>
          <ul id="p2_deck_wrap" className="cardWrap"></ul>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.14.0/Sortable.min.js" onLoad={handleScriptsLoaded} />
      <main>
        <div className="fieldWrap">
          <P1Area />
          <div className="shareArea">
            <div className="fromWrap">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <input type="text" name="num" id="left_code" className="inputLeft" placeholder="デッキコードを入力" />
                <select id="left_saved_deck" className="inputLeft" style={{ background: '#333', color: 'white', border: '1px solid #555', padding: '4px' }}>
                  <option value="">保存済みデッキから選択</option>
                </select>
              </div>
              <input type="button" id="set-btn" value="SET!" className="submitBtn" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <input type="text" name="num" id="right_code" className="inputRight" placeholder="デッキコードを入力" />
                <select id="right_saved_deck" className="inputRight" style={{ background: '#333', color: 'white', border: '1px solid #555', padding: '4px' }}>
                  <option value="">保存済みデッキから選択</option>
                </select>
              </div>
            </div>
            <div className="fromWrap" onContextMenu={(e) => e.preventDefault()}>
              <div className="btnWrap" style={{textAlign:'center',marginTop:10}}>
                <a id="p1_reset" className="btn01">引き直し</a>
                <a id="p2_reset" className="btn01">引き直し</a>
              </div>
              <div className="shareContent" onContextMenu={(e) => e.preventDefault()}>
                <div className="coinWrap boxLayout01">
                  <p className="boxTitle">coin</p>
                  <div className="coinArea">
                    <img id="coin" className="coinBack" src="https://funamushi.net/pokeca_hitorimawashi/img/coin.png" alt="coincheck!" />
                  </div>
                </div>
                <div className="stadiumWrap">
                  <div className="stadiumArea boxLayout01">
                    <div id="stadium_bg" className="bgLayout"></div>
                    <div className="boxTitle">stadium
                      <div className="btnWrap alR"><a id="stadium_trash" className="btn01">トラッシュ</a></div>
                    </div>
                    <ul id="stadium_wrap" className="cardWrap"></ul>
                  </div>
                </div>

              </div>
            </div>
          </div>
          <P2Area />
        </div>
        <div id="contextmenu" onContextMenu={(e) => e.preventDefault()}>
          <ul>
            <li id="retuen_to_deck">デッキに戻してシャッフル</li>
            <li id="move_to_trash">トラッシュ</li>

            <li id="move_to_top">デッキトップに戻す</li>
            <li id="move_to_bottom">デッキボトムに戻す</li>
            <li id="reverse_card">裏表を逆にする</li>
            <li id="move_to_hand">手札に加える</li>
          </ul>
        </div>
        <div className="loading is-hide" onContextMenu={(e) => e.preventDefault()}>
          <div className="loading_icon"></div>
        </div>
      </main>
    </>
  );
}

export default function Simulation() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <SimulationContent />
    </Suspense>
  );
}
