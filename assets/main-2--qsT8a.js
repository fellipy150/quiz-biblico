import"./game-D0NtWwqS.js";const d="https://patdjmbjdzjuwdrehfoz.supabase.co",c="sb_publishable_uQJTr6xrNAqfmKnTyNGcMw_S9q1wsXe",f=supabase.createClient(d,c);window.abrirRanking=async function(){const n=document.getElementById("modal-ranking"),a=document.getElementById("lista-ranking-container"),e=document.getElementById("lista-ranking-loader");n&&(n.style.display="flex"),a&&(a.innerHTML=""),e&&(e.style.display="block");const{data:o,error:s}=await f.from("ranking").select("*").order("pontuacao",{ascending:!1}).limit(10);if(e&&(e.style.display="none"),s){console.error("Erro ao buscar ranking:",s),a.innerHTML="<li style='text-align:center; color:red; padding:10px;'>Falha ao carregar ranking 😢</li>";return}o&&o.length>0?a.innerHTML=o.map((l,i)=>{const r=l.modo==="desafio"?"🔥":"🛡️";let t=`<div class="rank-pos">${i+1}</div>`;return i===0&&(t='<div class="rank-pos" style="background:#fbbf24; color:#000;">🥇</div>'),i===1&&(t='<div class="rank-pos" style="background:#94a3b8; color:#fff;">🥈</div>'),i===2&&(t='<div class="rank-pos" style="background:#b45309; color:#fff;">🥉</div>'),`
                <li class="rank-item">
                    <div style="display:flex; align-items:center;">
                        ${t}
                        <span style="text-transform: capitalize;">${l.nome}</span>
                    </div>
                    <div style="font-weight: 800; color: var(--brand-dark);">
                        ${l.pontuacao} pts ${r}
                    </div>
                </li>
            `}).join(""):a.innerHTML="<li style='text-align:center; color:#666; padding:20px;'>Nenhum Guardião registrado ainda.</li>"};window.fecharRanking=function(){const n=document.getElementById("modal-ranking");n&&(n.style.display="none")};
