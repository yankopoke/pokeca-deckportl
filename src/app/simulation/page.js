'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import './simulation.css';

export default function Simulation() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);

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

    // Deck load
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
          const res = await fetch(`/api/proxy?id=${cid1}`);
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) p1Deck = data;
          else { alert("P1: デッキが見つかりませんでした"); return; }
        }
        init("p1", p1Deck);
        setupInitialState("p1");

        if (cid2) {
          let p2Deck = [];
          if (cid2 === "maggyo") { p2Deck = p1Deck; }
          else {
            const res2 = await fetch(`/api/proxy?id=${cid2}`);
            const data2 = await res2.json();
            if (Array.isArray(data2) && data2.length > 0) p2Deck = data2;
          }
          if (p2Deck.length > 0) { init("p2", p2Deck); setupInitialState("p2"); }
        }
      } catch (e) { console.error(e); alert("エラーが発生しました"); }
      finally { document.querySelector(".loading").classList.add("is-hide"); }
    };

    // Zone controls for each player
    ["p1", "p2"].forEach(p => {
      // Draw, shuffle, deck view
      getEl(`${p}_draw_btn`).onclick = () => { const dw = getEl(`${p}_deck_wrap`); const hw = getEl(`${p}_hand_wrap`); if (dw && dw.firstElementChild) hw.appendChild(dw.firstElementChild); };
      getEl(`${p}_shuffle_btn`).onclick = () => { const dw = getEl(`${p}_deck_wrap`); const nodes = Array.from(dw.children).shuffle(); dw.innerHTML = ""; nodes.forEach(n => dw.appendChild(n)); };
      getEl(`${p}_deck_btn`).onclick = () => {
        const dl = getEl(`${p}_deck`);
        dl.style.display = dl.style.display === "none" ? "block" : "none";
        getEl(`${p}_deck_btn`).value = dl.style.display === "none" ? "デッキを見る" : "デッキを閉じる";
      };

      // Side buttons
      getEl(`${p}_side_open`).onclick = () => { const sw = getEl(`${p}_side_wrap`); Array.from(sw.children).forEach(c => c.classList.remove("hide")); };

      // Damage
      ["battle","bench1","bench2","bench3","bench4","bench5"].forEach(z => {
        const input = getEl(`${p}_${z}_damage_box`);
        const up = getEl(`${p}_${z}_damage_box_up`);
        const down = getEl(`${p}_${z}_damage_box_down`);
        if (up && down && input) {
          up.onclick = (e) => { e.preventDefault(); input.value = (parseInt(input.value) || 0) + 10; };
          down.onclick = (e) => { e.preventDefault(); input.value = Math.max(0, (parseInt(input.value) || 0) - 10); };
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

      // Reset
      const resetBtn = getEl(`${p}_reset`);
      if (resetBtn) resetBtn.onclick = () => setBtn.click();

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
        Array.from(hw.querySelectorAll(".card.checked")).forEach(c => { c.classList.remove("checked"); tw.appendChild(c); });
      };
      const handToDeck = getEl(`${p}_hand_to_deck`);
      if (handToDeck) handToDeck.onclick = () => {
        const hw = getEl(`${p}_hand_wrap`);
        const dw = getEl(`${p}_deck_wrap`);
        Array.from(hw.querySelectorAll(".card.checked")).forEach(c => { c.classList.remove("checked"); dw.appendChild(c); });
        const nodes = Array.from(dw.children).shuffle();
        dw.innerHTML = "";
        nodes.forEach(n => dw.appendChild(n));
      };
    });

    // Sortable
    const sortZones = [
      "p1_side_wrap","p1_battle_wrap","p1_hand_wrap","p1_trash_wrap","p1_deck_wrap","p1_lostzone_wrap",
      "p2_side_wrap","p2_battle_wrap","p2_hand_wrap","p2_trash_wrap","p2_deck_wrap","p2_lostzone_wrap",
      "stadium_wrap"
    ];
    [1,2,3,4,5,6,7,8].forEach(n => { sortZones.push(`p1_bench${n}_wrap`); sortZones.push(`p2_bench${n}_wrap`); });
    sortZones.forEach(id => {
      const el = getEl(id);
      if (el && window.Sortable) {
        window.Sortable.create(el, { group: id.startsWith("p1") ? "p1" : id.startsWith("p2") ? "p2" : "common", animation: 100 });
      }
    });

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

    // Auto load from URL
    const code = searchParams.get('code');
    if (code) { getEl("left_code").value = code; setBtn.click(); }
  };

  const BenchArea = ({ p, n }) => (
    <div id={`${p}_bench${n}`} className="benchArea boxLayout01" style={n > 5 ? {display:'none'} : {}}>
      <p className="boxTitle">bench {n}
        <input id={`${p}_bench${n}_damage_box`} type="tel" name="num" className="damageBox" defaultValue="0" />
        <a id={`${p}_bench${n}_damage_box_up`} className="btn01">▲</a>
        <a id={`${p}_bench${n}_damage_box_down`} className="btn01">▼</a>
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
            <a id="p1_battle_to_deck" className="btn01">デッキ戻し</a>
            <a id="p1_battle_trash" className="btn01">トラッシュ</a>
          </div>
          <ul id="p1_battle_wrap" className="cardWrap"></ul>
        </div>
        <div id="p1_lostzone" className="lostArea boxLayout01" style={{display:'none'}}>
          <div className="boxTitle">lost(<span id="p1_lostzone_remaining">0</span>)</div>
          <div className="btnWrap"><a id="p1_lostzone_sort" className="btn01">並び替え</a></div>
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
              <a id="p1_uncheck" className="btn01" style={{marginLeft:10}}>チェック解除</a>
            </div>
            <div className="btnWrap">
              <a id="p1_hand_sort" className="btn01">並び替え</a>
              <a id="p1_hand_trash" className="btn01">トラッシュ</a>
              <a id="p1_hand_to_deck" className="btn01">デッキ戻し</a>
              <a id="p1_hand_hakase" className="btn01">博士</a>
              <a id="p1_hand_nanjamo" className="btn01">ナンジャモ</a>
              <a id="p1_hand_judgeman" className="btn01">ジャッジマン</a>
              <a id="p1_hand_to_deck_bottom" className="btn01">デッキ下</a>
            </div>
            <ul id="p1_hand_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div id="p1_trash" className="trashWrap">
          <div className="trashArea boxLayout01">
            <div className="boxTitle">trash(<span id="p1_trash_remaining">0</span>)</div>
            <div className="btnWrap">
              <a id="p1_trash_sort" className="btn01">並び替え</a>
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

      {/* Stadium */}
      <div className="stadiumWrap">
        <div className="stadiumArea boxLayout01">
          <div id="stadium_bg" className="bgLayout"></div>
          <div className="boxTitle">stadium
            <div className="btnWrap alR"><a id="stadium_trash" className="btn01">トラッシュ</a></div>
          </div>
          <ul id="stadium_wrap" className="cardWrap"></ul>
        </div>
      </div>

      {/* Battle */}
      <div className="battleWrap">
        <div id="p2_lostzone" className="lostArea boxLayout01" style={{display:'none'}}>
          <div className="boxTitle">lost(<span id="p2_lostzone_remaining">0</span>)</div>
          <div className="btnWrap"><a id="p2_lostzone_sort" className="btn01">並び替え</a></div>
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
              <a id="p2_uncheck" className="btn01" style={{marginLeft:10}}>チェック解除</a>
            </div>
            <div className="btnWrap">
              <a id="p2_hand_sort" className="btn01">並び替え</a>
              <a id="p2_hand_trash" className="btn01">トラッシュ</a>
              <a id="p2_hand_to_deck" className="btn01">デッキ戻し</a>
              <a id="p2_hand_hakase" className="btn01">博士</a>
              <a id="p2_hand_nanjamo" className="btn01">ナンジャモ</a>
              <a id="p2_hand_judgeman" className="btn01">ジャッジマン</a>
              <a id="p2_hand_to_deck_bottom" className="btn01">デッキ下</a>
            </div>
            <ul id="p2_hand_wrap" className="cardWrap"></ul>
          </div>
        </div>
        <div id="p2_trash" className="trashWrap">
          <div className="trashArea boxLayout01">
            <div className="boxTitle">trash(<span id="p2_trash_remaining">0</span>)</div>
            <div className="btnWrap">
              <a id="p2_trash_sort" className="btn01">並び替え</a>
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
          <P2Area />
          <div className="shareArea">
            <div className="fromWrap">
              <input type="text" name="num" id="left_code" className="inputLeft" placeholder="デッキコードを入力" />
              <input type="button" id="set-btn" value="SET!" className="submitBtn" />
              <input type="text" name="num" id="right_code" className="inputRight" placeholder="デッキコードを入力" />
            </div>
            <div className="fromWrap" onContextMenu={(e) => e.preventDefault()}>
              <div className="btnWrap" style={{textAlign:'center',marginTop:10}}>
                <a id="p1_reset" className="btn01">引き直し</a>
                <a id="smartphone_btn" className="smartphoneBtn">スマホエリア追加</a>
                <a id="p2_reset" className="btn01">引き直し</a>
              </div>
              <div className="shareContent" onContextMenu={(e) => e.preventDefault()}>
                <div className="coinWrap boxLayout01">
                  <p className="boxTitle">coin</p>
                  <div className="coinArea">
                    <img id="coin" className="coinBack" src="https://funamushi.net/pokeca_hitorimawashi/img/coin.png" alt="coincheck!" />
                  </div>
                </div>
                <div className="damageCountWrap boxLayout01" onContextMenu={(e) => e.preventDefault()}>
                  <p className="boxTitle">damageCounter</p>
                  <div className="damageCountArea" id="app">
                    <div id="damecan10" className="damecan" data-damege="10">10</div>
                    <div id="damecan50" className="damecan" data-damege="50">50</div>
                    <div id="damecan100" className="damecan" data-damege="100">100</div>
                    <div id="trashBox" className="trashBox">
                      <img src="https://funamushi.net/pokeca_hitorimawashi/img/gomibako.png" alt="" style={{width:'100%'}} />
                    </div>
                  </div>
                </div>
                <div className="arrArea" onContextMenu={(e) => e.preventDefault()}>
                  <div id="moveLeftButton" className="arrLeft">&lt;</div>
                  <div id="moveRightButton" className="arrRight">&gt;</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="contextmenu" onContextMenu={(e) => e.preventDefault()}>
          <ul>
            <li id="retuen_to_deck">デッキに戻してシャッフル</li>
            <li id="move_to_trash">トラッシュ</li>
            <li id="go_to_card_page">大きい画像を表示</li>
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
