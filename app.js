const APP_NAME = "Meu Veículo",
  APP_VERSION = "5.1 RC2",
  APP_CREATED = "julho de 2026";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n) || 0,
  );
const num = (n, d = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(n) || 0);
const intFmt = (n) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Number(n) || 0,
  );
const TYPES = {
  ABASTECIMENTO: ["COMBUSTIVEL"],
  DESPESA: ["ADMINISTRATIVA"],
  RECEITA: ["RECEITA"],
  SERVICO: ["MANUTENCAO"],
};
let movements = [],
  registers = [],
  drivers = [],
  vehicles = [];
const defaults = [
  ["ABASTECIMENTO", "COMBUSTIVEL", "Etanol", 1],
  ["ABASTECIMENTO", "COMBUSTIVEL", "Gasolina", 0],
  ["ABASTECIMENTO", "COMBUSTIVEL", "Diesel", 0],
  ["DESPESA", "ADMINISTRATIVA", "Adesivos/Soleiras", 0],
  ["DESPESA", "ADMINISTRATIVA", "Gorjeta", 0],
  ["DESPESA", "ADMINISTRATIVA", "Impostos (IPVA/DPVAT)", 1],
  ["DESPESA", "ADMINISTRATIVA", "Macaco", 0],
  ["DESPESA", "ADMINISTRATIVA", "Multa", 0],
  ["DESPESA", "ADMINISTRATIVA", "Protetor Solar/Parabrisa", 0],
  ["DESPESA", "ADMINISTRATIVA", "Seguro", 0],
  ["RECEITA", "RECEITA", "Reembolso", 1],
  ["SERVICO", "MANUTENCAO", "Bateria", 0],
  ["SERVICO", "MANUTENCAO", "Filtro de Ar", 0],
  ["SERVICO", "MANUTENCAO", "Filtro de Ar da Cabine", 0],
  ["SERVICO", "MANUTENCAO", "Filtro de Combustível", 0],
  ["SERVICO", "MANUTENCAO", "Filtro de Óleo", 1],
  ["SERVICO", "MANUTENCAO", "Fluido de Freio", 0],
  ["SERVICO", "MANUTENCAO", "Fluido Radiador", 0],
  ["SERVICO", "MANUTENCAO", "Lava-jato", 0],
  ["SERVICO", "MANUTENCAO", "Mão de obra", 0],
  ["SERVICO", "MANUTENCAO", "Pneus - Calibragem", 0],
  ["SERVICO", "MANUTENCAO", "Troca de Freio", 0],
  ["SERVICO", "MANUTENCAO", "Troca de Óleo", 0],
  ["SERVICO", "MANUTENCAO", "Vidros/Espelhos", 0],
].map((x, i) => ({
  id: "r" + i,
  tipo: x[0],
  categoria: x[1],
  subcategoria: x[2],
  padrao: !!x[3],
}));
function save(syncCloud = true) {
  localStorage.setItem("mv_movements_v32", JSON.stringify(movements));
  localStorage.setItem("mv_registers_v32", JSON.stringify(registers));
  localStorage.setItem("mv_drivers_v32", JSON.stringify(drivers));
  localStorage.setItem("mv_vehicles_v32", JSON.stringify(vehicles));
  renderAll();
  if (syncCloud) window.cloudSync?.queueSave();
}
function parseCSV(t) {
  const a = [];
  let r = [],
    f = "",
    q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i],
      n = t[i + 1];
    if (c === '"') {
      if (q && n === '"') {
        f += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      r.push(f);
      f = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      r.push(f);
      if (r.some(Boolean)) a.push(r);
      r = [];
      f = "";
    } else f += c;
  }
  return a;
}
function normalizeMovement(o, i = 0) {
  const fuel = (o.subcategoria || "").toLowerCase();
  if (fuel.includes("gas")) o.subcategoria = "Gasolina";
  o.id = o.id || "m" + i;
  o.ordem_lancamento = Number.isFinite(+o.ordem_lancamento)
    ? +o.ordem_lancamento
    : i + 1;
  o.valor = +o.valor || 0;
  o.hodometro_km = +o.hodometro_km || 0;
  o.quantidade_litros = +o.quantidade_litros || null;
  o.preco_unitario = +o.preco_unitario || null;
  o.distancia_km = +o.distancia_km || null;
  const rawVehicle = o.veiculo || o.veiculo_nome || "";
  if (
    String(rawVehicle).toUpperCase().includes("SONATA") ||
    o.veiculo_id === "v2" ||
    String(rawVehicle).includes("Veículo 2")
  )
    o.veiculo = "Hyundai Sonata";
  else if (
    String(rawVehicle).toUpperCase().includes("HB20") ||
    o.veiculo_id === "v1" ||
    !rawVehicle
  )
    o.veiculo = "Hyundai HB20 1.6 • 2021/22";
  else o.veiculo = rawVehicle;
  o.motorista = o.motorista || drivers[0]?.nome || "N.I.";
  delete o.fornecedor;
  return o;
}
function newestFirst(a, b) {
  const byDate = new Date(b.data_hora || 0) - new Date(a.data_hora || 0);
  return (
    byDate ||
    (+b.ordem_lancamento || 0) - (+a.ordem_lancamento || 0) ||
    String(b.id || "").localeCompare(String(a.id || ""))
  );
}
function movementKey(m) {
  return [
    m.veiculo || "",
    m.tipo || "",
    m.data_hora || "",
    Number(m.hodometro_km) || 0,
    Number(m.valor) || 0,
    m.subcategoria || "",
    m.origem || "",
  ].join("|");
}
async function seedMovements() {
  try {
    const t = await fetch("data/dataset_veicular_app.csv?v=42", {
        cache: "no-store",
      }).then((r) => {
        if (!r.ok) throw new Error("dataset");
        return r.text();
      }),
      rows = parseCSV(t),
      h = rows.shift().map((k) =>
        String(k || "")
          .replace(/^\uFEFF/, "")
          .trim(),
      );
    return rows.map((r, i) => {
      const o = {};
      h.forEach((k, j) => (o[k] = r[j]));
      return normalizeMovement(o, i);
    });
  } catch (e) {
    console.error("Falha ao carregar dataset", e);
    return [];
  }
}
async function load() {
  registers =
    JSON.parse(localStorage.getItem("mv_registers_v32") || "null") || defaults;
  drivers = JSON.parse(localStorage.getItem("mv_drivers_v32") || "null") || [
    { id: "d1", nome: "MARCELO BR", padrao: true },
  ];
  vehicles = JSON.parse(localStorage.getItem("mv_vehicles_v32") || "null") || [
    {
      id: "v1",
      nome: "Hyundai HB20 1.6 • 2021/22",
      kmInicial: 51475,
      padrao: true,
      ativo: true,
    },
    {
      id: "v2",
      nome: "Hyundai Sonata",
      kmInicial: 120000,
      padrao: false,
      ativo: false,
    },
  ];
  vehicles = vehicles.map((v) => {
    const isHb = String(v.nome || "")
        .toUpperCase()
        .includes("HB20"),
      isSonata = String(v.nome || "")
        .toUpperCase()
        .includes("SONATA");
    return {
      ...v,
      kmInicial: +v.kmInicial || (isHb ? 51475 : isSonata ? 120000 : 0),
      ativo: isHb ? true : isSonata ? false : v.ativo !== false,
    };
  });
  if (
    !vehicles.some((v) =>
      String(v.nome || "")
        .toUpperCase()
        .includes("HB20"),
    )
  )
    vehicles.unshift({
      id: "v1",
      nome: "Hyundai HB20 1.6 • 2021/22",
      kmInicial: 51475,
      padrao: true,
      ativo: true,
    });
  if (
    !vehicles.some((v) =>
      String(v.nome || "")
        .toUpperCase()
        .includes("SONATA"),
    )
  )
    vehicles.push({
      id: "v2",
      nome: "Hyundai Sonata",
      kmInicial: 120000,
      padrao: false,
      ativo: false,
    });
  const hb = vehicles.find((v) =>
      String(v.nome || "")
        .toUpperCase()
        .includes("HB20"),
    ),
    sonata = vehicles.find((v) =>
      String(v.nome || "")
        .toUpperCase()
        .includes("SONATA"),
    );
  if (hb) {
    hb.ativo = true;
    hb.padrao = true;
  }
  if (sonata) {
    sonata.ativo = false;
    sonata.padrao = false;
  }
  vehicles
    .filter((v) => v !== hb)
    .forEach((v) => {
      if (v.padrao) v.padrao = false;
    });
  const seed = await seedMovements(),
    stored = JSON.parse(localStorage.getItem("mv_movements_v32") || "null");
  movements = (stored || []).map((o, i) => normalizeMovement(o, i));
  const keys = new Set(movements.map(movementKey));
  seed.forEach((m) => {
    const k = movementKey(m);
    if (!keys.has(k)) {
      movements.push(m);
      keys.add(k);
    }
  });
  localStorage.setItem("mv_data_migration", "v38-status-veiculos");
  recalculateDistances();
  save();
  console.info("Base carregada", {
    total: movements.length,
    hb20: movements.filter((m) => m.veiculo.includes("HB20")).length,
    sonata: movements.filter((m) => m.veiculo.includes("Sonata")).length,
  });
}
function vehicleName(id) {
  return (
    vehicles.find((v) => v.id === id)?.nome ||
    id ||
    vehicles[0]?.nome ||
    "Sem veículo"
  );
}
function defaultVehicle() {
  return vehicles.find((v) => v.padrao && v.ativo !== false) || null;
}
function vehicleSummary(v) {
  const ms = movements.filter((m) => m.veiculo === v.nome),
    odos = ms.map((m) => +m.hodometro_km || 0).filter(Boolean),
    last = odos.length ? Math.max(...odos) : +v.kmInicial || 0,
    initial = +v.kmInicial || 0;
  return {
    initial,
    last,
    driven: Math.max(0, last - initial),
    stats: stats(ms),
  };
}
function recalculateDistances() {
  vehicles.forEach((v) => {
    const ms = movements
      .filter((m) => m.veiculo === v.nome && +m.hodometro_km > 0)
      .sort(
        (a, b) =>
          new Date(a.data_hora) - new Date(b.data_hora) ||
          +a.hodometro_km - +b.hodometro_km,
      );
    let prev = +v.kmInicial || 0;
    ms.forEach((m) => {
      const km = +m.hodometro_km || 0;
      m.distancia_km = Math.max(0, km - prev);
      prev = Math.max(prev, km);
    });
    const fuels = ms
      .filter((m) => m.tipo === "ABASTECIMENTO")
      .sort(
        (a, b) =>
          new Date(a.data_hora) - new Date(b.data_hora) ||
          +a.hodometro_km - +b.hodometro_km,
      );
    let prevFuel = +v.kmInicial || 0;
    fuels.forEach((m) => {
      const km = +m.hodometro_km || 0,
        dist = Math.max(0, km - prevFuel);
      m.distancia_abastecimento_km = dist;
      m.consumo_km_l =
        +m.quantidade_litros > 0 && dist > 0
          ? dist / +m.quantidade_litros
          : null;
      prevFuel = Math.max(prevFuel, km);
    });
  });
}
function activeVehicle() {
  return (
    vehicles.find((v) => v.ativo !== false) ||
    defaultVehicle() ||
    vehicles[0] ||
    null
  );
}
function fillVehicleSelects() {
  const active = activeVehicle(),
    vehicleOpts = vehicles
      .map(
        (v) =>
          `<option value="${v.nome}">${v.nome}${v.ativo === false ? " (Inativo)" : " (Ativo)"}</option>`,
      )
      .join(""),
    allOpts = '<option value="">Todos os veículos</option>' + vehicleOpts,
    home = $("#homeVehicle");
  home.innerHTML = active
    ? `<option value="${active.nome}">${active.nome}</option>`
    : '<option value="">Nenhum veículo ativo</option>';
  home.value = active?.nome || "";
  ["movementVehicle"].forEach((id) => {
    const e = $("#" + id),
      old = e.value;
    e.innerHTML = allOpts;
    const valid = vehicles.some((v) => v.nome === old);
    e.value = valid ? old : active?.nome || "";
  });
  ["reportVehicle", "chartVehicle"].forEach((id) => {
    const e = $("#" + id),
      old = e.value;
    e.innerHTML = vehicleOpts;
    const valid = vehicles.some((v) => v.nome === old);
    e.value = valid ? old : active?.nome || vehicles[0]?.nome || "";
  });
}
function fillDrivers() {
  const e = $("#entryForm [name=motorista]");
  e.innerHTML =
    '<option value="">Não informado</option>' +
    drivers
      .map(
        (d) =>
          `<option value="${d.nome}" ${d.padrao ? "selected" : ""}>${d.nome}</option>`,
      )
      .join("");
}
function filtered(vehicle = "") {
  return vehicle ? movements.filter((m) => m.veiculo === vehicle) : movements;
}
function periodValues(prefix) {
  return {
    start: $("#" + prefix + "Start")?.value || "",
    end: $("#" + prefix + "End")?.value || "",
  };
}
function periodIsValid(prefix) {
  const { start, end } = periodValues(prefix),
    error = $("#" + prefix + "PeriodError");
  if (start && end && end < start) {
    if (error) error.textContent = "A data final não pode ser anterior à data inicial.";
    return false;
  }
  if (error) error.textContent = "";
  return true;
}
function filterByPeriod(ms, prefix) {
  const { start, end } = periodValues(prefix);
  if (!periodIsValid(prefix)) {
    const empty = [];
    empty.periodFiltered = true;
    return empty;
  }
  const result = ms.filter((m) => {
    const date = String(m.data_hora || "").slice(0, 10);
    return date && (!start || date >= start) && (!end || date <= end);
  });
  result.periodFiltered = !!(start || end);
  result.periodStart = start;
  result.periodEnd = end;
  return result;
}
function periodText(prefix) {
  const { start, end } = periodValues(prefix),
    fmt = (date) => date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "…";
  return start || end ? `${fmt(start)} a ${fmt(end)}` : "Geral";
}
function stats(ms) {
  const valid = ms.filter((m) => m.data_hora),
    cost = valid
      .filter((m) => m.tipo !== "RECEITA")
      .reduce((a, m) => a + (+m.valor || 0), 0),
    income = valid
      .filter((m) => m.tipo === "RECEITA")
      .reduce((a, m) => a + (+m.valor || 0), 0),
    names = [...new Set(valid.map((m) => m.veiculo).filter(Boolean))];
  let km = 0;
  if (ms.periodFiltered) {
    km = valid.reduce((total, m) => total + Math.max(0, +(m.distancia_km || 0)), 0);
  } else if (names.length > 1) {
    km = names.reduce(
      (sum, n) => sum + stats(valid.filter((m) => m.veiculo === n)).km,
      0,
    );
  } else {
    const name = names[0],
      vehicle = vehicles.find((v) => v.nome === name),
      odos = valid.map((m) => +m.hodometro_km || 0).filter((n) => n > 0),
      last = odos.length ? Math.max(...odos) : 0,
      initial = +vehicle?.kmInicial || (odos.length ? Math.min(...odos) : 0);
    km = Math.max(0, last - initial);
  }
  const dates = valid.map((m) => new Date(m.data_hora)),
    selectedDays = ms.periodStart && ms.periodEnd
      ? Math.floor(
          (Date.parse(ms.periodEnd + "T12:00:00") -
            Date.parse(ms.periodStart + "T12:00:00")) /
            86400000,
        ) + 1
      : 0,
    days = selectedDays > 0
      ? selectedDays
      : dates.length
        ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / 86400000)
        : 1,
    liters = valid
      .filter((m) => m.tipo === "ABASTECIMENTO")
      .reduce((a, m) => a + (+m.quantidade_litros || 0), 0);
  return {
    cost,
    income,
    net: cost - income,
    km,
    days,
    cons: liters ? km / liters : 0,
  };
}
function icon(m) {
  return m.tipo === "ABASTECIMENTO"
    ? "⛽"
    : m.tipo === "SERVICO"
      ? "🔧"
      : m.tipo === "RECEITA"
        ? "↙"
        : "🧾";
}
function item(m, editable = false) {
  return `<article class="item ${m.tipo === "RECEITA" ? "income" : ""}"><div><b>${icon(m)} ${m.subcategoria}</b><small>${new Date(m.data_hora).toLocaleDateString("pt-BR")} · ${m.categoria} · ${m.veiculo || "Sem veículo"}</small></div><div class="amount"><b>${m.tipo === "RECEITA" ? "+" : "-"} ${money(m.valor)}</b><small>${intFmt(m.hodometro_km)} km</small>${editable ? `<div class="movement-actions"><button type="button" class="edit-movement" data-edit-movement="${m.id}">Alterar</button><button type="button" class="delete-movement" data-delete-movement="${m.id}">Excluir</button></div>` : ""}</div></article>`;
}
function renderHome() {
  const v = $("#homeVehicle").value,
    ms = filtered(v),
    s = stats(ms),
    last = [...ms].sort(
      (a, b) => (+b.hodometro_km || 0) - (+a.hodometro_km || 0),
    )[0],
    lastFuel = [...ms]
      .filter((m) => m.tipo === "ABASTECIMENTO" && +m.quantidade_litros > 0)
      .sort(
        (a, b) =>
          new Date(b.data_hora) - new Date(a.data_hora) ||
          +b.hodometro_km - +a.hodometro_km,
      )[0];
  $("#vehicleName").textContent = v || "Todos os veículos";
  $("#vehicleOdo").textContent = last
    ? intFmt(last.hodometro_km) + " km"
    : "— km";
  $("#netTotal").textContent = money(s.net);
  $("#costKm").textContent = s.km ? money(s.net / s.km) : money(0);
  $("#dailyKm").textContent = num(s.km / s.days) + " km";
  $("#avgConsumption").textContent = num(s.cons) + " km/L";
  $("#lastConsumption").textContent = lastFuel?.consumo_km_l
    ? num(lastFuel.consumo_km_l) + " km/L"
    : "—";
  $("#lastDistance").textContent =
    lastFuel?.distancia_abastecimento_km != null
      ? intFmt(lastFuel.distancia_abastecimento_km) + " km"
      : "—";
  $("#dailyCost").textContent = money(s.net / s.days);
  $("#periodLabel").textContent = `${ms.length} lançamentos`;
  const sortedDates = ms.filter(m => m.data_hora).sort((a,b) => new Date(a.data_hora)-new Date(b.data_hora));
  const midpoint = Math.floor(sortedDates.length / 2);
  const previous = stats(sortedDates.slice(0, midpoint));
  const recent = stats(sortedDates.slice(midpoint));
  const costDelta = previous.km && recent.km ? ((recent.net/recent.km)/(previous.net/previous.km)-1)*100 : 0;
  const consDelta = previous.cons && recent.cons ? (recent.cons/previous.cons-1)*100 : 0;
  $("#smartInsights").innerHTML = `<article><strong>Indicadores inteligentes</strong><span>${costDelta ? `Custo por km ${costDelta > 0 ? "aumentou" : "reduziu"} ${num(Math.abs(costDelta),1)}% no período mais recente.` : "Inclua mais lançamentos para comparar o custo por km."}</span><span>${consDelta ? `Consumo médio ${consDelta > 0 ? "melhorou" : "caiu"} ${num(Math.abs(consDelta),1)}%.` : "O consumo será comparado automaticamente conforme o histórico crescer."}</span></article>`;
  $("#vehicleCards").innerHTML = vehicles
    .map((x) => {
      const z = vehicleSummary(x);
      return `<article class="vehicle-card ${x.padrao ? "default" : ""} ${x.ativo === false ? "inactive" : ""}"><div><b>${x.nome}</b><small>${x.ativo === false ? "Inativo · somente consultas" : x.padrao ? "Ativo · veículo padrão" : "Ativo"}</small></div><strong>${intFmt(z.last)} km</strong><span>Inicial ${intFmt(z.initial)} · Rodados ${intFmt(z.driven)} km · ${z.driven ? money(z.stats.net / z.driven) : money(0)}/km</span></article>`;
    })
    .join("");
  $("#recentList").innerHTML =
    [...ms]
      .sort(newestFirst)
      .slice(0, 5)
      .map(item)
      .join("") || '<p class="muted">Nenhum lançamento.</p>';
}
function deleteMovement(id) {
  const m = movements.find((x) => x.id === id);
  if (!m) return;
  const resumo = `${m.subcategoria || m.tipo} de ${new Date(m.data_hora).toLocaleDateString("pt-BR")} no valor de ${money(m.valor)}`;
  if (
    !confirm(
      `Excluir este lançamento?\n\n${resumo}\n\nEsta ação não poderá ser desfeita.`,
    )
  )
    return;
  movements = movements.filter((x) => x.id !== id);
  recalculateDistances();
  save();
}
function renderMovements() {
  const v = $("#movementVehicle").value,
    t = $("#typeFilter").value,
    q = $("#search").value.toLowerCase();
  const ms = filterByPeriod(filtered(v), "movement")
    .filter(
      (m) =>
        (!t || m.tipo === t) &&
        (!q || JSON.stringify(m).toLowerCase().includes(q)),
    )
    .sort(newestFirst);
  $("#movementCount").textContent = `${ms.length} lançamento(s) · Período: ${periodText("movement")}`;
  $("#movementList").innerHTML =
    ms.map((m) => item(m, true)).join("") ||
    '<p class="muted">Nenhum lançamento.</p>';
  $$("[data-edit-movement]").forEach(
    (b) => (b.onclick = () => openEntry(b.dataset.editMovement)),
  );
  $$("[data-delete-movement]").forEach(
    (b) => (b.onclick = () => deleteMovement(b.dataset.deleteMovement)),
  );
}
function groupTotals(ms) {
  const g = { Combustível: 0, Administrativo: 0, Serviços: 0, Receitas: 0 };
  ms.forEach((m) => {
    if (m.tipo === "ABASTECIMENTO") g.Combustível += +m.valor || 0;
    else if (m.tipo === "DESPESA") g.Administrativo += +m.valor || 0;
    else if (m.tipo === "SERVICO") g.Serviços += +m.valor || 0;
    else if (m.tipo === "RECEITA") g.Receitas += +m.valor || 0;
  });
  return g;
}
function categoryCostTable(ms) {
  const s = stats(ms),
    g = groupTotals(ms),
    expenses = [
      ["Combustível", g.Combustível],
      ["Administrativo", g.Administrativo],
      ["Serviços", g.Serviços],
    ],
    totalExpenses = expenses.reduce((a, [, v]) => a + (+v || 0), 0),
    income = +g.Receitas || 0,
    net = totalExpenses - income,
    perKm = (v) => (s.km ? v / s.km : 0),
    perDay = (v) => (s.days ? v / s.days : 0);
  const rows = expenses
    .map(
      ([name, value]) =>
        `<tr><th scope="row">${name}</th><td>${num(totalExpenses ? (value / totalExpenses) * 100 : 0, 1)}%</td><td>${money(value)}</td><td>${money(perKm(value))}</td><td>${money(perDay(value))}</td></tr>`,
    )
    .join("");
  return `<div class="category-table-wrap"><table class="category-cost-table"><thead><tr><th>Categoria</th><th>Participação</th><th>Valor</th><th>Custo/km</th><th>Custo/dia</th></tr></thead><tbody>${rows}<tr class="total-expenses"><th scope="row">Total de gastos</th><td>${totalExpenses ? num(100, 1) + "%" : "0,0%"}</td><td>${money(totalExpenses)}</td><td>${money(perKm(totalExpenses))}</td><td>${money(perDay(totalExpenses))}</td></tr><tr class="income-row"><th scope="row">Receitas</th><td>—</td><td>− ${money(income)}</td><td>− ${money(perKm(income))}</td><td>− ${money(perDay(income))}</td></tr><tr class="net-cost-row"><th scope="row">Custo líquido</th><td>—</td><td>${money(net)}</td><td>${money(perKm(net))}</td><td>${money(perDay(net))}</td></tr></tbody></table></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function reportSubcategories(ms) {
  const groups = {};
  ms.forEach((m) => {
    const group = m.tipo === "ABASTECIMENTO" ? "Combustível" : m.tipo === "SERVICO" ? "Manutenção" : m.tipo === "DESPESA" ? "Administrativo" : "Receitas";
    const name = m.subcategoria || "Sem subcategoria";
    const key = `${group}|${name}`;
    const row = groups[key] ||= { group, name, total: 0, count: 0, last: "" };
    row.total += +m.valor || 0;
    row.count += 1;
    if (!row.last || String(m.data_hora || "") > row.last) row.last = String(m.data_hora || "");
  });
  const groupTotalsMap = {};
  Object.values(groups).forEach((r) => groupTotalsMap[r.group] = (groupTotalsMap[r.group] || 0) + r.total);
  return Object.values(groups).map((r) => ({ ...r, share: groupTotalsMap[r.group] ? r.total / groupTotalsMap[r.group] * 100 : 0 })).sort((a,b) => b.total-a.total || a.name.localeCompare(b.name));
}
function subcategoryCostTable(ms, limit = 0) {
  const rows = reportSubcategories(ms), shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return '<p class="muted">Sem dados por subcategoria.</p>';
  return `<div class="category-table-wrap"><table class="category-cost-table"><thead><tr><th>Grupo</th><th>Subcategoria</th><th>Qtde.</th><th>% do grupo</th><th>Valor total</th><th>Última ocorrência</th></tr></thead><tbody>${shown.map(r => `<tr><td>${escapeHtml(r.group)}</td><th scope="row">${escapeHtml(r.name)}</th><td>${r.count}</td><td>${num(r.share,1)}%</td><td>${money(r.total)}</td><td>${r.last ? new Date(r.last).toLocaleDateString("pt-BR") : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function fuelReportData(ms) {
  const fuels = {};
  ms.filter(m => m.tipo === "ABASTECIMENTO").sort((a,b) => new Date(a.data_hora)-new Date(b.data_hora)).forEach((m) => {
    const name = m.subcategoria || "Combustível";
    const g = fuels[name] ||= { name, cost: 0, liters: 0, distance: 0, records: 0, valid: [] };
    g.cost += +m.valor || 0; g.liters += +m.quantidade_litros || 0;
    const d = +(m.distancia_abastecimento_km ?? m.distancia_km) || 0;
    g.distance += d; g.records += 1;
    if (d > 0 && +m.quantidade_litros > 0) g.valid.push({ consumption: d / +m.quantidade_litros, date: m.data_hora });
  });
  const totalCost = Object.values(fuels).reduce((a,g)=>a+g.cost,0);
  return Object.values(fuels).map(g => {
    const n = g.valid.length;
    const confidence = n < 3 ? "Dados insuficientes" : n < 6 ? "Amostra limitada" : n < 10 ? "Resultado preliminar" : "Resultado confiável";
    const historical = n ? g.valid.reduce((a,x)=>a+x.consumption,0)/n : 0;
    const recentSlice = g.valid.slice(-Math.min(3,n));
    const recent = recentSlice.length ? recentSlice.reduce((a,x)=>a+x.consumption,0)/recentSlice.length : 0;
    const delta = historical && recent ? (recent/historical-1)*100 : 0;
    const trend = n < 3 ? "Sem tendência" : Math.abs(delta) <= 3 ? "Estável" : delta > 0 ? "Melhorando" : "Piorando";
    return {...g, n, confidence, historical, recent, delta, trend, share: totalCost ? g.cost/totalCost*100 : 0, costKm: g.distance ? g.cost/g.distance : 0};
  }).sort((a,b)=>b.cost-a.cost);
}
function reportDateTime() { return new Date().toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }); }

function renderReports() {
  const ms = filterByPeriod(filtered($("#reportVehicle").value), "report"),
    s = stats(ms);
  $("#reportPeriodLabel").textContent = `Período: ${periodText("report")}`;
  $("#grossTotal").textContent = money(s.cost);
  $("#reportNet").textContent = money(s.net);
  $("#incomeTotal").textContent = money(s.income);
  $("#reportDistance").textContent = intFmt(s.km) + " km";
  const fuels = {};
  ms.filter((m) => m.tipo === "ABASTECIMENTO").forEach((m) => {
    const k = m.subcategoria || "Combustível",
      g = fuels[k] || (fuels[k] = { c: 0, l: 0, d: 0 });
    g.c += +m.valor || 0;
    g.l += +m.quantidade_litros || 0;
    g.d += +(m.distancia_abastecimento_km ?? m.distancia_km) || 0;
  });
  const fuelTotal = Object.values(fuels).reduce(
      (t, g) => ({ c: t.c + g.c, l: t.l + g.l, d: t.d + g.d }),
      { c: 0, l: 0, d: 0 },
    ),
    combined = fuelTotal.l
      ? `<div class="bar fuel-combined"><div><span>Combustíveis: ${num(fuelTotal.d / fuelTotal.l)} km/L</span><b>${money(fuelTotal.d ? fuelTotal.c / fuelTotal.d : 0)}/km</b></div><div class="track"><div class="fill" style="width:100%"></div></div></div>`
      : "";
  $("#fuelBars").innerHTML =
    (Object.entries(fuels)
      .map(
        ([k, g]) =>
          `<div class="bar"><div><span>${k}: ${num(g.l ? g.d / g.l : 0)} km/L</span><b>${money(g.d ? g.c / g.d : 0)}/km</b></div><div class="track"><div class="fill" style="width:${Math.min(100, (g.c / Math.max(...Object.values(fuels).map((x) => x.c), 1)) * 100)}%"></div></div></div>`,
      )
      .join("") + combined) || '<p class="muted">Sem abastecimentos.</p>';
  $("#categoryBars").innerHTML = categoryCostTable(ms);
  const sub = $("#subcategoryTotals"); if (sub) sub.innerHTML = subcategoryCostTable(ms);
}
function withTotal(labels, values) {
  return {
    labels: [...labels, "Total"],
    values: [...values, values.reduce((a, v) => a + (+v || 0), 0)],
  };
}

function chartPalette() {
  const light = document.documentElement.dataset.theme === "light";
  return {
    text: light ? "#17324d" : "#d8e9f6",
    strong: light ? "#12395b" : "#ffffff",
    grid: light ? "#8ca3b566" : "#6f8ba166",
    donutCenter: light ? "#ffffff" : "#0b2539"
  };
}
function compactValue(v, format = "money") {
  if (format === "percent") return num(v, 1) + "%";
  const a = Math.abs(v);
  if (a >= 1000000) return "R$ " + num(v / 1000000, 1) + " mi";
  if (a >= 1000) return "R$ " + num(v / 1000, 1) + " mil";
  return money(v);
}
function fullChartValue(v, format = "money") {
  if (format === "percent") return num(v, 1) + "%";
  if (format === "consumption") return num(v, 2) + " km/L";
  if (format === "km") return intFmt(v) + " km";
  return money(v);
}
function canShowFixedValues(w, itemCount, seriesCount = 1) {
  const mobile = w < 700;
  const available = w / Math.max(itemCount * seriesCount, 1);
  return !mobile && itemCount * seriesCount <= 8 && available >= 78;
}
function setupCanvasTooltip(canvas, hitAreas) {
  canvas._chartHitAreas = hitAreas || [];
  let tip = document.getElementById("chartTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "chartTooltip";
    tip.className = "chart-tooltip";
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  const show = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const hit = (canvas._chartHitAreas || []).find(a => x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2);
    if (!hit) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${hit.label}</b><span>${hit.value}</span>`;
    tip.hidden = false;
    const pad = 12;
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - pad, clientX + 12) + "px";
    tip.style.top = Math.max(pad, clientY - tip.offsetHeight - 12) + "px";
  };
  if (!canvas._tooltipBound) {
    canvas.addEventListener("mousemove", e => show(e.clientX, e.clientY));
    canvas.addEventListener("mouseleave", () => { tip.hidden = true; });
    canvas.addEventListener("click", e => show(e.clientX, e.clientY));
    canvas.addEventListener("touchstart", e => {
      const t = e.touches[0]; if (t) show(t.clientX, t.clientY);
    }, { passive: true });
    canvas._tooltipBound = true;
  }
}
function selectedPeriodMonths(prefix = "chart") {
  const start = $("#" + prefix + "Start")?.value;
  const end = $("#" + prefix + "End")?.value;
  if (!start || !end) return Infinity;
  const a = new Date(start + "T00:00:00"), b = new Date(end + "T00:00:00");
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
    .format(new Date(y, m - 1, 1)).replace(" de ", "/").replace(".", "");
}
function drawChart(canvas, labels, values, format = "money") {
  const dpr = devicePixelRatio || 1,
    w = canvas.clientWidth || 600,
    h = Math.max(canvas.clientHeight || 300, 300),
    bottom = labels.length > 5 ? 72 : 56,
    showValues = canShowFixedValues(w, labels.length);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext("2d"); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
  const max = Math.max(...values.map(Math.abs), 1), left = 48, right = 18,
    bw = (w - left - right) / Math.max(labels.length, 1), hitAreas = [];
  c.font = "11px system-ui"; c.fillStyle = chartPalette().text;
  labels.forEach((l, i) => {
    const barW = Math.max(8, bw * 0.64), x = left + i * bw + bw * 0.18,
      y = h - bottom - (Math.abs(values[i]) / max) * (h - bottom - 58), bh = h - bottom - y;
    c.fillStyle = values[i] < 0 ? "#1f8a70" : "#246b9e"; c.fillRect(x, y, barW, bh);
    hitAreas.push({ x1: x - 6, x2: x + barW + 6, y1: Math.min(y, h - bottom) - 10, y2: h - bottom + 8, label: String(l), value: fullChartValue(values[i], format) });
    if (showValues) {
      c.font = "800 10px system-ui"; c.fillStyle = chartPalette().strong; c.textAlign = "center";
      c.fillText(compactValue(values[i], format), x + barW / 2, Math.max(16, y - 7));
    }
    c.font = "11px system-ui"; c.fillStyle = chartPalette().text; c.save();
    c.translate(x + barW / 2, h - bottom + 15);
    if (labels.length > 5 || bw < 72) c.rotate(-Math.PI / 5);
    c.textAlign = labels.length > 5 || bw < 72 ? "right" : "center"; c.fillText(String(l), 0, 0); c.restore();
  });
  setupCanvasTooltip(canvas, hitAreas);
}
function drawGroupedChart(canvas, labels, series, format = "money") {
  const dpr = devicePixelRatio || 1,
    w = canvas.clientWidth || 600,
    h = Math.max(canvas.clientHeight || 300, 300),
    top = series.length > 2 ? 54 : 38,
    bottom = 72;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  const all = series.flatMap((x) => x.values),
    max = Math.max(...all.map(Math.abs), 1),
    left = 48,
    right = 18,
    gw = (w - left - right) / Math.max(labels.length, 1),
    barW = Math.max(5, Math.min(26, gw / Math.max(series.length + 1, 2))),
    showValues = canShowFixedValues(w, labels.length, series.length),
    hitAreas = [];
  c.font = "10px system-ui";
  labels.forEach((label, i) => {
    series.forEach((ser, j) => {
      const v = +ser.values[i] || 0,
        x = left + i * gw + (gw - series.length * barW) / 2 + j * barW,
        y = h - bottom - (Math.abs(v) / max) * (h - bottom - top),
        bh = h - bottom - y;
      c.fillStyle = ser.active ? "#246b9e" : "#d9822b";
      c.fillRect(x, y, barW * 0.82, bh);
      hitAreas.push({ x1: x - 4, x2: x + barW, y1: Math.min(y, h - bottom) - 8, y2: h - bottom + 8, label: `${label} — ${ser.name}`, value: fullChartValue(v, format) });
      if (showValues) {
        const valueLabel = compactValue(v, format);
        c.font = "800 10px system-ui";
        c.fillStyle = "#ffffff";
        c.textAlign = "center";
        c.fillText(valueLabel, x + barW * 0.41, Math.max(14, y - 6));
        c.font = "10px system-ui";
      }
    });
    c.fillStyle = chartPalette().text;
    c.save();
    c.translate(left + i * gw + gw / 2, h - bottom + 16);
    if (gw < 85) c.rotate(-Math.PI / 5);
    c.textAlign = gw < 85 ? "right" : "center";
    c.fillText(String(label), 0, 0);
    c.restore();
  });
  let lx = left,
    ly = 14;
  series.forEach((ser) => {
    const label = ser.name + (ser.active ? " (Ativo)" : " (Inativo)"),
      need = c.measureText(label).width + 30;
    if (lx + need > w - right) {
      lx = left;
      ly += 18;
    }
    c.fillStyle = ser.active ? "#246b9e" : "#d9822b";
    c.fillRect(lx, ly - 9, 10, 10);
    c.fillStyle = chartPalette().text;
    c.textAlign = "left";
    c.fillText(label, lx + 14, ly);
    lx += need;
  });
  c.textAlign = "center";
  setupCanvasTooltip(canvas, hitAreas);
}
function chartSeriesFor(vehicle, metric) {
  const ms = filterByPeriod(filtered(vehicle.nome), "chart"),
    s = stats(ms),
    g = groupTotals(ms),
    labels = Object.keys(g),
    raw = Object.values(g).map((v, i) => (labels[i] === "Receitas" ? -v : v));
  let vals = raw;
  if (metric === "km") vals = raw.map((v) => (s.km ? v / s.km : 0));
  if (metric === "day") vals = raw.map((v) => (s.days ? v / s.days : 0));
  return withTotal(labels, vals).values;
}
function yearlyFor(vehicle) {
  const y = {};
  filterByPeriod(filtered(vehicle.nome), "chart").forEach((m) => {
    const k = (m.data_hora || "").slice(0, 4);
    if (k)
      y[k] =
        (y[k] || 0) + (m.tipo === "RECEITA" ? -(+m.valor || 0) : +m.valor || 0);
  });
  return y;
}
function canvasBase(canvas, minHeight = 280) {
  const dpr = devicePixelRatio || 1,
    w = canvas.clientWidth || 600,
    h = Math.max(canvas.clientHeight || minHeight, minHeight);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  return { c, w, h };
}
function axisLabel(value, format) {
  if (format === "consumption") return num(value, 1);
  if (format === "km") return intFmt(value);
  if (format === "thousands") return value === 0 ? "R$ 0" : "R$ " + num(value / 1000, value >= 1000 ? 0 : 1) + "k";
  return money(value);
}
function drawLineChart(canvas, labels, values, format = "money", color = "#246b9e", options = {}) {
  const { showYAxisLabels = true, showPointValues = true, yMin = null, yMax = null, yStep = null } = options;
  const { c, w, h } = canvasBase(canvas), left = showYAxisLabels ? 66 : 24, right = 22, top = 28, bottom = 58,
    plotW = w - left - right, plotH = h - top - bottom;
  const dataMax = Math.max(...values.map(Number), 1), dataMin = Math.min(...values.map(Number), 0);
  let min = yMin !== null ? yMin : Math.min(0, dataMin), max = yMax !== null ? yMax : dataMax;
  if (yStep) {
    min = Math.floor(min / yStep) * yStep;
    max = Math.ceil(max / yStep) * yStep;
    if (max <= min) max = min + yStep;
  }
  const span = Math.max(max - min, 1), fixedValues = showPointValues && canShowFixedValues(w, labels.length), hitAreas = [];
  c.strokeStyle = chartPalette().grid; c.fillStyle = chartPalette().text; c.lineWidth = 1; c.font = "11px system-ui";
  const ticks = yStep ? Math.max(1, Math.round(span / yStep)) : 4;
  for (let i = 0; i <= ticks; i++) {
    const y = top + plotH * i / ticks, value = max - span * i / ticks;
    c.beginPath(); c.moveTo(left, y); c.lineTo(w - right, y); c.stroke();
    if (showYAxisLabels) { c.textAlign = "right"; c.fillText(axisLabel(value, format), left - 7, y + 4); }
  }
  const points = values.map((value, i) => ({
    x: labels.length === 1 ? left + plotW / 2 : left + plotW * i / Math.max(labels.length - 1, 1),
    y: top + (max - value) / span * plotH,
  }));
  c.strokeStyle = color; c.lineWidth = 3; c.beginPath();
  points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
  points.forEach((p, i) => {
    c.fillStyle = color; c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill();
    hitAreas.push({ x1: p.x - 14, x2: p.x + 14, y1: p.y - 14, y2: p.y + 14, label: String(labels[i] || `Ponto ${i + 1}`), value: fullChartValue(values[i], format) });
    if (fixedValues) { c.fillStyle = chartPalette().strong; c.font = "800 11px system-ui"; c.textAlign = "center"; c.fillText(axisLabel(values[i], format), p.x, Math.max(14, p.y - 10)); }
    c.fillStyle = chartPalette().text; c.font = "11px system-ui"; c.save(); c.translate(p.x, h - bottom + 18);
    if (labels.length > 6) c.rotate(-Math.PI / 5);
    c.textAlign = labels.length > 6 ? "right" : "center"; c.fillText(labels[i], 0, 0); c.restore();
  });
  setupCanvasTooltip(canvas, hitAreas);
}
function drawMonthlyChart(canvas, labels, values) {
  const { c, w, h } = canvasBase(canvas, 300), left = 58, right = 18, top = 24, bottom = 70,
    plotH = h - top - bottom, max = Math.max(...values, 1), step = (w - left - right) / Math.max(labels.length, 1),
    showValues = canShowFixedValues(w, labels.length), hitAreas = [];
  c.font = "11px system-ui";
  for (let i = 0; i <= 4; i++) {
    const y = top + plotH * i / 4, value = max * (1 - i / 4);
    c.strokeStyle = chartPalette().grid; c.beginPath(); c.moveTo(left, y); c.lineTo(w - right, y); c.stroke();
    c.fillStyle = chartPalette().text; c.textAlign = "right"; c.fillText(axisLabel(value, "thousands"), left - 7, y + 4);
  }
  values.forEach((value, i) => {
    const barW = Math.max(5, step * .62), x = left + i * step + (step - barW) / 2, bh = value / max * plotH, y = top + plotH - bh;
    c.fillStyle = "#246b9e"; c.fillRect(x, y, barW, bh);
    hitAreas.push({ x1: x - 5, x2: x + barW + 5, y1: Math.min(y, top + plotH) - 8, y2: top + plotH + 8, label: String(labels[i]), value: fullChartValue(value, "money") });
    if (showValues) { c.fillStyle = chartPalette().strong; c.font = "800 10px system-ui"; c.textAlign = "center"; c.fillText(compactValue(value), x + barW / 2, Math.max(14, y - 6)); }
    c.fillStyle = chartPalette().text; c.font = "11px system-ui"; c.save(); c.translate(x + barW / 2, h - bottom + 17);
    if (labels.length > 6) c.rotate(-Math.PI / 5);
    c.textAlign = labels.length > 6 ? "right" : "center"; c.fillText(labels[i], 0, 0); c.restore();
  });
  setupCanvasTooltip(canvas, hitAreas);
}
function drawDonut(canvas, labels, values) {
  const { c, w, h } = canvasBase(canvas), colors = ["#246b9e", "#d94b4b", "#1f8a70", "#6f8fb3", "#b63b62", "#3f9db8", "#8b6bb1"],
    total = values.reduce((a, n) => a + Math.max(0, n), 0) || 1, radius = Math.min(w, h) * .31, inner = radius * .58,
    cx = w / 2, cy = h / 2, legend = $("#annualDonutLegend");
  let start = -Math.PI / 2;
  values.forEach((value, i) => {
    const angle = Math.max(0, value) / total * Math.PI * 2;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, radius, start, start + angle); c.closePath(); c.fillStyle = colors[i % colors.length]; c.fill(); start += angle;
  });
  c.beginPath(); c.arc(cx, cy, inner, 0, Math.PI * 2); c.fillStyle = chartPalette().donutCenter; c.fill();
  c.fillStyle = chartPalette().strong; c.textAlign = "center"; c.font = "700 13px system-ui"; c.fillText("Custo diário", cx, cy - 4);
  c.font = "800 18px system-ui"; c.fillText(money(values.reduce((a, n) => a + n, 0) / Math.max(values.length, 1)), cx, cy + 20);
  legend.innerHTML = labels.map((label, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${label}: ${money(values[i])}/dia</span>`).join("");
}
function annualChartData(ms) {
  const byYear = {};
  ms.forEach((m) => {
    const year = (m.data_hora || "").slice(0, 4); if (!year) return;
    const item = byYear[year] ||= { gross: 0, income: 0, dates: [] };
    if (m.tipo === "RECEITA") item.income += +m.valor || 0; else item.gross += +m.valor || 0;
    item.dates.push((m.data_hora || "").slice(0, 10));
  });
  const years = Object.keys(byYear).sort(), selectedStart = $("#chartStart").value, selectedEnd = $("#chartEnd").value;
  return {
    years,
    gross: years.map(y => byYear[y].gross),
    income: years.map(y => byYear[y].income),
    net: years.map(y => byYear[y].gross - byYear[y].income),
    daily: years.map(y => {
      const dates = byYear[y].dates.filter(Boolean).sort();
      const start = selectedStart && selectedStart.slice(0, 4) === y ? selectedStart : (dates[0] || `${y}-01-01`);
      const end = selectedEnd && selectedEnd.slice(0, 4) === y ? selectedEnd : (dates.at(-1) || `${y}-12-31`);
      const days = Math.max(1, Math.round((new Date(end + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000) + 1);
      return (byYear[y].gross - byYear[y].income) / days;
    })
  };
}
function semesterConsumptionData(ms) {
  const groups = {};
  ms.filter(m => m.tipo === "ABASTECIMENTO" && +m.quantidade_litros > 0 && +m.distancia_abastecimento_km > 0).forEach(m => {
    const raw = m.data_hora || "", year = raw.slice(0, 4), month = +(raw.slice(5, 7) || 0);
    if (!year || !month) return;
    const sem = month <= 6 ? 1 : 2, key = `${year}-S${sem}`;
    const g = groups[key] ||= { distance: 0, liters: 0 };
    g.distance += +m.distancia_abastecimento_km; g.liters += +m.quantidade_litros;
  });
  const keys = Object.keys(groups).sort();
  return { labels: keys.map(k => `${k.slice(5)}º sem./${k.slice(0,4)}`.replace("S1º","1º").replace("S2º","2º")), values: keys.map(k => groups[k].liters ? groups[k].distance / groups[k].liters : 0) };
}
function topSubcategoryData(ms) {
  const totals = {};
  ms.filter(m => m.tipo !== "RECEITA").forEach(m => { const name = m.subcategoria || "Sem subcategoria"; totals[name] = (totals[name] || 0) + (+m.valor || 0); });
  const rows = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return { labels: rows.map(r=>r[0]), values: rows.map(r=>r[1]) };
}
function renderNewCharts(ms) {
  const semesters = semesterConsumptionData(ms);
  drawLineChart($("#chartAnnualConsumption"), semesters.labels, semesters.values, "consumption", "#246b9e", { showYAxisLabels: false, showPointValues: false });
  const annual = annualChartData(ms);
  drawGroupedChart($("#chartMonthly"), annual.years, [
    { name: "Custo bruto", active: true, values: annual.gross },
    { name: "Receitas", active: false, values: annual.income },
    { name: "Custo líquido", active: true, values: annual.net }
  ], "money");
  drawLineChart($("#chartAnnualDaily"), annual.years, annual.daily, "money", "#d94b4b", { showYAxisLabels: false, showPointValues: false });
  const odo = ms.filter(m => +m.hodometro_km > 0).sort((a,b) => new Date(a.data_hora) - new Date(b.data_hora) || +a.hodometro_km - +b.hodometro_km);
  const odoGroups = {};
  odo.forEach(m => { const key=(m.data_hora||"").slice(0,7); if(key) odoGroups[key]=Math.max(odoGroups[key]||0,+m.hodometro_km); });
  const odoKeys=Object.keys(odoGroups).sort(), odoValues=odoKeys.map(k=>odoGroups[k]), initial=odo.length ? +odo[0].hodometro_km : 0;
  drawLineChart($("#chartOdometer"), odoKeys.map(monthLabel), odoValues, "km", "#246b9e", { showPointValues:false, yMin: initial, yStep:5000 });
  const top = topSubcategoryData(ms);
  drawChart($("#chartSubcategory"), top.labels, top.values, "money");
}
function renderCharts() {
  const selected = $("#chartVehicle").value,
    allVisible = filterByPeriod(filtered(selected), "chart"),
    validPeriod = periodIsValid("chart");
  $("#chartPeriodLabel").textContent = `Período: ${periodText("chart")}`;
  $("#chartEmpty").hidden = !validPeriod || allVisible.length > 0;
  $("#chartContent").hidden = !validPeriod || allVisible.length === 0;
  if (!validPeriod || !allVisible.length) return;
  renderNewCharts(allVisible);
  if (selected) {
    const ms = allVisible,
      s = stats(ms),
      g = groupTotals(ms),
      labels = Object.keys(g),
      raw = Object.values(g).map((v, i) => (labels[i] === "Receitas" ? -v : v)),
      total = withTotal(labels, raw);
    drawChart($("#chartTotal"), total.labels, total.values, "money");
    const km = withTotal(
      labels,
      raw.map((v) => (s.km ? v / s.km : 0)),
    );
    drawChart($("#chartKm"), km.labels, km.values, "money");
    const day = withTotal(
      labels,
      raw.map((v) => (s.days ? v / s.days : 0)),
    );
    drawChart($("#chartDay"), day.labels, day.values, "money");
    return;
  }
  const labels = [
      "Combustível",
      "Administrativo",
      "Serviços",
      "Receitas",
      "Total",
    ],
    series = vehicles.map((v) => ({
      name: v.nome,
      active: v.ativo !== false,
      values: chartSeriesFor(v, "total"),
    }));
  drawGroupedChart($("#chartTotal"), labels, series, "money");
  drawGroupedChart(
    $("#chartKm"),
    labels,
    vehicles.map((v) => ({
      name: v.nome,
      active: v.ativo !== false,
      values: chartSeriesFor(v, "km"),
    })),
    "money",
  );
  drawGroupedChart(
    $("#chartDay"),
    labels,
    vehicles.map((v) => ({
      name: v.nome,
      active: v.ativo !== false,
      values: chartSeriesFor(v, "day"),
    })),
    "money",
  );
}
function renderRegisters() {
  const group = $("#registerGroup").value;
  let rows = [];
  if (group === "SUBCATEGORIA")
    rows = registers.map((r) => ({
      id: r.id,
      title: r.subcategoria,
      sub: `${r.tipo} · ${r.categoria}${r.padrao ? " · Padrão" : ""}`,
    }));
  if (group === "MOTORISTA")
    rows = drivers.map((r) => ({
      id: r.id,
      title: r.nome,
      sub: r.padrao ? "Padrão" : "Motorista",
    }));
  if (group === "VEICULO")
    rows = vehicles.map((r) => {
      const z = vehicleSummary(r);
      return {
        id: r.id,
        title: r.nome,
        sub: `${r.ativo === false ? "INATIVO · somente consultas" : r.padrao ? "ATIVO · Padrão" : "ATIVO"} · Inicial ${intFmt(z.initial)} km · Atual ${intFmt(z.last)} km · Rodados ${intFmt(z.driven)} km`,
      };
    });
  $("#registerList").innerHTML =
    rows
      .map(
        (r) =>
          `<article class="register-row"><div><b>${r.title}</b><small>${r.sub}</small></div><div><button data-edit="${r.id}">Alterar</button><button class="danger" data-delete="${r.id}">Excluir</button></div></article>`,
      )
      .join("") || '<p class="muted">Nenhum cadastro.</p>';
  $$("[data-edit]").forEach(
    (b) => (b.onclick = () => openRegister(b.dataset.edit)),
  );
  $$("[data-delete]").forEach(
    (b) => (b.onclick = () => deleteRegister(b.dataset.delete)),
  );
}
function renderAll() {
  fillVehicleSelects();
  fillDrivers();
  renderHome();
  renderMovements();
  renderReports();
  renderRegisters();
  setTimeout(renderCharts, 50);
}
function go(id) {
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === id));
  $$("nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === id),
  );
  if (id === "graficos") setTimeout(renderCharts, 50);
}
$$("[data-page]").forEach((b) => (b.onclick = () => go(b.dataset.page)));
$$("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
const headerMenu = $("#headerMenu"), menuBtn = $("#menuBtn");
menuBtn.onclick = (event) => {
  event.stopPropagation();
  headerMenu.hidden = !headerMenu.hidden;
  menuBtn.setAttribute("aria-expanded", String(!headerMenu.hidden));
};
$$("[data-menu-page]").forEach((button) => button.onclick = () => {
  headerMenu.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  go(button.dataset.menuPage);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".header-menu-wrap")) {
    headerMenu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }
});
function fillTypeSelect(select) {
  select.innerHTML = Object.keys(TYPES)
    .map((t) => `<option value="${t}">${t}</option>`)
    .join("");
}
function typeForCategory(category) {
  return (
    Object.entries(TYPES).find(([, cats]) => cats.includes(category))?.[0] ||
    registers.find((r) => r.categoria === category)?.tipo ||
    ""
  );
}
function updateEntryLists() {
  const f = $("#entryForm"),
    oldCategory = f.categoria.value,
    oldSub = f.subcategoria.value,
    categories = [
      ...new Set(registers.map((r) => r.categoria).filter(Boolean)),
    ];
  f.categoria.innerHTML = categories
    .map((c) => `<option>${c}</option>`)
    .join("");
  if (categories.includes(oldCategory)) f.categoria.value = oldCategory;
  const type = typeForCategory(f.categoria.value);
  f.tipo.value = type;
  const rs = registers.filter((r) => r.categoria === f.categoria.value);
  f.subcategoria.innerHTML = rs
    .map(
      (r) => `<option ${r.padrao ? "selected" : ""}>${r.subcategoria}</option>`,
    )
    .join("");
  if (rs.some((r) => r.subcategoria === oldSub)) f.subcategoria.value = oldSub;
  const fuel = type === "ABASTECIMENTO";
  $("#fuelFields").style.display = fuel ? "block" : "none";
  $("#nonFuelValue").style.display = fuel ? "none" : "block";
}
function kmBounds(date, vehicle, excludeId = "") {
  const day = String(date || "").slice(0, 10),
    ms = movements.filter(
      (m) =>
        m.id !== excludeId &&
        m.veiculo === vehicle &&
        +m.hodometro_km > 0 &&
        m.data_hora,
    );
  const previous = ms
    .filter((m) => String(m.data_hora).slice(0, 10) <= day)
    .sort((a, b) => +b.hodometro_km - +a.hodometro_km)[0];
  const next = ms
    .filter((m) => String(m.data_hora).slice(0, 10) > day)
    .sort((a, b) => +a.hodometro_km - +b.hodometro_km)[0];
  return { prev: previous, next };
}
function updateKm() {
  const f = $("#entryForm"),
    id = f.movementId.value,
    current = id ? movements.find((m) => m.id === id) : null,
    v = current
      ? vehicles.find((x) => x.nome === current.veiculo)
      : defaultVehicle(),
    b = kmBounds(f.data.value, v?.nome || "", id),
    base = b.prev?.hodometro_km ?? v?.kmInicial ?? 0;
  $("#lastKm").value = intFmt(base);
  if (!current && !String(f.km.value || "").replace(/\D/g, ""))
    f.km.value = intFmt(base);
  $("#kmRule").textContent = b.next
    ? `Hodômetro permitido: de ${intFmt(base)} a ${intFmt(b.next.hodometro_km)} km.`
    : `O hodômetro não pode ser menor que ${intFmt(base)} km.`;
}
function openEntry(id = "") {
  const f = $("#entryForm"),
    current = id ? movements.find((m) => m.id === id) : null,
    v = current
      ? vehicles.find((x) => x.nome === current.veiculo)
      : defaultVehicle(),
    err = $("#formError");
  f.reset();
  f.movementId.value = id;
  err.textContent = "";
  if (!v || v.ativo === false) {
    alert(
      current
        ? "Lançamentos de veículo inativo estão disponíveis somente para consulta."
        : "Cadastre e defina um veículo ativo como padrão antes de realizar lançamentos.",
    );
    if (!current) {
      go("cadastros");
      $("#registerGroup").value = "VEICULO";
      renderRegisters();
    }
    return;
  }
  $("#entryTitle").textContent = current
    ? "Alterar lançamento"
    : "Novo lançamento";
  $("#entryVehicleName").textContent = v.nome;
  f.data.value = current
    ? String(current.data_hora).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  updateEntryLists();
  if (current) {
    f.categoria.value = current.categoria;
    updateEntryLists();
    f.subcategoria.value = current.subcategoria;
    f.km.value = intFmt(current.hodometro_km);
    if (current.tipo === "ABASTECIMENTO") {
      f.valor.value = current.valor || "";
      f.litros.value = current.quantidade_litros || "";
      f.precoLitro.value = current.preco_unitario || "";
    } else f.valorComum.value = current.valor || "";
    f.tanqueCompleto.checked = current.tanque_completo !== "NAO";
    f.motorista.value = current.motorista || "";
    f.observacao.value =
      current.observacao === "N.I." ? "" : current.observacao || "";
  }
  fillDrivers();
  if (current) f.motorista.value = current.motorista || "";
  updateKm();
  $("#entryDialog").showModal();
}
$("#newEntry").onclick = () => openEntry();
$("#addMovement").onclick = () => openEntry();
$("#entryForm [name=categoria]").onchange = updateEntryLists;
$("#entryForm [name=data]").onchange = () => {
  const f = $("#entryForm");
  if (!f.movementId.value) f.km.value = "";
  updateKm();
};
$("#entryForm [name=km]").oninput = (e) =>
  (e.target.value = intFmt(String(e.target.value).replace(/\D/g, "")));
const moneyFieldNames = ["precoLitro", "valor", "valorComum"];
function moneyInputNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}
function formatMoneyInput(input) {
  const value = moneyInputNumber(input.value);
  input.value = value ? num(value, 2) : "";
}
moneyFieldNames.forEach((name) => {
  const input = $(`#entryForm [name=${name}]`);
  input.type = "text";
  input.inputMode = "numeric";
  input.addEventListener("input", () => formatMoneyInput(input));
});
const entryDialogElement = $("#entryDialog"),
  nativeShowEntry = entryDialogElement.showModal.bind(entryDialogElement);
entryDialogElement.showModal = () => {
  moneyFieldNames.forEach((name) => {
    const input = $(`#entryForm [name=${name}]`),
      value = Number(input.value);
    if (input.value && Number.isFinite(value)) input.value = num(value, 2);
  });
  nativeShowEntry();
};
$("#entryForm").addEventListener(
  "submit",
  () =>
    moneyFieldNames.forEach((name) => {
      const input = $(`#entryForm [name=${name}]`);
      if (input.value) input.value = moneyInputNumber(input.value).toFixed(2);
    }),
  true,
);
function syncFuel() {
  const f = $("#entryForm"),
    p = moneyInputNumber(f.precoLitro.value),
    v = moneyInputNumber(f.valor.value);
  f.litros.value = p > 0 && v > 0 ? (v / p).toFixed(3) : "";
}
["precoLitro", "valor"].forEach((n) =>
  $("#entryForm [name=" + n + "]").addEventListener("input", syncFuel),
);
$("#entryForm").onsubmit = (e) => {
  if (e.submitter?.value === "cancel") return;
  e.preventDefault();
  const f = e.target,
    d = Object.fromEntries(new FormData(f)),
    id = f.movementId.value,
    current = id ? movements.find((m) => m.id === id) : null,
    km = +String(d.km).replace(/\D/g, ""),
    err = $("#formError"),
    v = current
      ? vehicles.find((x) => x.nome === current.veiculo)
      : defaultVehicle();
  if (!v || v.ativo === false) {
    err.textContent = current
      ? "Veículo inativo: lançamento disponível somente para consulta."
      : "Cadastre e defina um veículo ativo como padrão antes de realizar lançamentos.";
    return;
  }
  d.veiculo = v.nome;
  d.tipo = typeForCategory(d.categoria);
  if (!d.tipo || !d.categoria || !d.subcategoria) {
    err.textContent = "Categoria e subcategoria são obrigatórias.";
    return;
  }
  const b = kmBounds(d.data, d.veiculo, id);
  if (b.prev && km < +b.prev.hodometro_km) {
    err.textContent = `O hodômetro não pode ser menor que ${intFmt(b.prev.hodometro_km)} km para esta data.`;
    return;
  }
  if (b.next && km > +b.next.hodometro_km) {
    err.textContent = `O hodômetro não pode ser maior que ${intFmt(b.next.hodometro_km)} km, pois existe lançamento posterior.`;
    return;
  }
  let valor = d.tipo === "ABASTECIMENTO" ? +f.valor.value : +f.valorComum.value;
  if (d.tipo === "ABASTECIMENTO") {
    syncFuel();
    if (!(+f.precoLitro.value > 0 && valor > 0 && +f.litros.value > 0)) {
      err.textContent =
        "Informe o preço por litro e o valor total para calcular a quantidade de litros.";
      return;
    }
  }
  if (!(valor >= 0)) {
    err.textContent = "Informe o valor total.";
    return;
  }
  const prevAny = b.prev,
    dist = Math.max(0, km - (+prevAny?.hodometro_km || +v.kmInicial || 0)),
    prevFuel = [...movements]
      .filter(
        (m) =>
          m.id !== id &&
          m.veiculo === d.veiculo &&
          m.tipo === "ABASTECIMENTO" &&
          String(m.data_hora).slice(0, 10) <= d.data &&
          +m.hodometro_km <= km,
      )
      .sort((a, b) => b.hodometro_km - a.hodometro_km)[0],
    fuelDist = Math.max(0, km - (+prevFuel?.hodometro_km || +v.kmInicial || 0)),
    obj = {
      id: id || crypto.randomUUID(),
      ordem_lancamento:
        current?.ordem_lancamento ||
        Math.max(0, ...movements.map((m) => +m.ordem_lancamento || 0)) + 1,
      tipo: d.tipo,
      data_hora: d.data + "T12:00:00",
      hodometro_km: km,
      categoria: d.categoria,
      subcategoria: d.subcategoria,
      valor,
      quantidade_litros: d.tipo === "ABASTECIMENTO" ? +f.litros.value : null,
      preco_unitario: d.tipo === "ABASTECIMENTO" ? +f.precoLitro.value : null,
      distancia_km: dist,
      distancia_abastecimento_km: d.tipo === "ABASTECIMENTO" ? fuelDist : null,
      consumo_km_l:
        d.tipo === "ABASTECIMENTO" && fuelDist && +f.litros.value
          ? fuelDist / +f.litros.value
          : null,
      tanque_completo:
        d.tipo === "ABASTECIMENTO"
          ? d.tanqueCompleto
            ? "SIM"
            : "NAO"
          : "N.I.",
      motorista: d.motorista || "N.I.",
      veiculo: d.veiculo,
      observacao: d.observacao || "N.I.",
      origem: current?.origem || "APP",
    };
  if (current) Object.assign(current, obj);
  else movements.push(obj);
  recalculateDistances();
  err.textContent = "";
  save();
  $("#entryDialog").close();
  go("movimentos");
};
function fillRegisterForm() {
  const f = $("#registerForm");
  fillTypeSelect(f.tipo);
  f.tipo.onchange = () =>
    (f.categoria.innerHTML = (TYPES[f.tipo.value] || [])
      .map((c) => `<option>${c}</option>`)
      .join(""));
  f.tipo.onchange();
}
function openRegister(id = "") {
  const group = $("#registerGroup").value,
    f = $("#registerForm");
  f.reset();
  f.id.value = "";
  f.grupo.value = group;
  $("#subcatFields").style.display =
    group === "SUBCATEGORIA" ? "block" : "none";
  $("#simpleFields").style.display =
    group === "SUBCATEGORIA" ? "none" : "block";
  $("#simpleLabel").firstChild.textContent =
    group === "VEICULO" ? "Veículo *" : "Motorista *";
  $("#initialKmField").style.display = group === "VEICULO" ? "block" : "none";
  $("#activeVehicleField").style.display =
    group === "VEICULO" ? "flex" : "none";
  fillRegisterForm();
  let obj;
  if (group === "SUBCATEGORIA") obj = registers.find((x) => x.id === id);
  else if (group === "MOTORISTA") obj = drivers.find((x) => x.id === id);
  else obj = vehicles.find((x) => x.id === id);
  if (obj) {
    f.id.value = obj.id;
    if (group === "SUBCATEGORIA") {
      f.tipo.value = obj.tipo;
      f.tipo.onchange();
      f.categoria.value = obj.categoria;
      f.subcategoria.value = obj.subcategoria;
      f.padrao.checked = obj.padrao;
    } else {
      f.nome.value = obj.nome;
      f.kmInicial.value = obj.kmInicial ? intFmt(obj.kmInicial) : "";
      f.simplePadrao.checked = !!obj.padrao;
      f.ativo.checked = obj.ativo !== false;
    }
  }
  $("#registerTitle").textContent = id
    ? "Alterar cadastro"
    : "Incluir cadastro";
  $("#registerDialog").showModal();
}
function deleteRegister(id) {
  if (!confirm("Excluir este cadastro?")) return;
  const g = $("#registerGroup").value;
  if (g === "SUBCATEGORIA") registers = registers.filter((x) => x.id !== id);
  if (g === "MOTORISTA") drivers = drivers.filter((x) => x.id !== id);
  if (g === "VEICULO") vehicles = vehicles.filter((x) => x.id !== id);
  save();
}
$("#registerForm [name=kmInicial]").oninput = (e) =>
  (e.target.value = intFmt(String(e.target.value).replace(/\D/g, "")));
$("#addRegister").onclick = () => openRegister();
$("#registerGroup").onchange = renderRegisters;
$("#registerForm").onsubmit = (e) => {
  if (e.submitter?.value === "cancel") return;
  e.preventDefault();
  const f = e.target,
    g = f.grupo.value,
    id = f.id.value;
  if (g === "SUBCATEGORIA") {
    const obj = {
      id: id || crypto.randomUUID(),
      tipo: f.tipo.value,
      categoria: f.categoria.value,
      subcategoria: f.subcategoria.value.trim(),
      padrao: f.padrao.checked,
    };
    if (!obj.subcategoria) return;
    if (obj.padrao)
      registers.forEach((r) => {
        if (r.tipo === obj.tipo && r.categoria === obj.categoria)
          r.padrao = false;
      });
    if (id)
      Object.assign(
        registers.find((x) => x.id === id),
        obj,
      );
    else registers.push(obj);
  } else {
    const arr = g === "MOTORISTA" ? drivers : vehicles,
      name = f.nome.value.trim(),
      isActive = g === "VEICULO" ? f.ativo.checked : true,
      isDefault = f.simplePadrao.checked && isActive,
      kmInicial = +String(f.kmInicial.value || "").replace(/\D/g, "");
    if (!name) return;
    if (g === "VEICULO" && !kmInicial) return;
    if (isDefault) arr.forEach((x) => (x.padrao = false));
    if (id) {
      const item = arr.find((x) => x.id === id);
      item.nome = name;
      item.padrao = isDefault;
      if (g === "VEICULO") {
        item.kmInicial = kmInicial;
        item.ativo = isActive;
        if (!isActive) item.padrao = false;
      }
    } else
      arr.push({
        id: crypto.randomUUID(),
        nome: name,
        kmInicial: g === "VEICULO" ? kmInicial : undefined,
        padrao: isDefault || arr.length === 0,
        ativo: isActive,
      });
    if (g === "VEICULO" && !arr.some((x) => x.padrao && x.ativo !== false)) {
      const first = arr.find((x) => x.ativo !== false);
      if (first) first.padrao = true;
    }
  }
  recalculateDistances();
  save();
  $("#registerDialog").close();
};
["homeVehicle", "movementVehicle", "reportVehicle", "chartVehicle"].forEach(
  (id) => ($("#" + id).onchange = renderAll),
);
$("#typeFilter").innerHTML =
  '<option value="">Todos os tipos</option>' +
  Object.keys(TYPES)
    .map((t) => `<option>${t}</option>`)
    .join("");
$("#typeFilter").onchange = renderMovements;
$("#search").oninput = renderMovements;
[
  ["movement", renderMovements],
  ["report", renderReports],
  ["chart", renderCharts],
].forEach(([prefix, render]) => {
  ["Start", "End"].forEach((suffix) => {
    $("#" + prefix + suffix).onchange = render;
  });
  $("#clear" + prefix[0].toUpperCase() + prefix.slice(1) + "Period").onclick = () => {
    $("#" + prefix + "Start").value = "";
    $("#" + prefix + "End").value = "";
    render();
  };
});
function esc(v) {
  return String(v ?? "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
function col(n) {
  let s = "";
  while (n) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
function sheet(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => (typeof v === "number" ? `<c r="${col(j + 1)}${i + 1}"><v>${v}</v></c>` : `<c r="${col(j + 1)}${i + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`)).join("")}</row>`).join("")}</sheetData></worksheet>`;
}
async function exportXlsx() {
  const keys = movements.length
    ? Object.keys(movements[0])
    : ["id", "tipo", "data_hora", "veiculo"];
  const mov = [keys, ...movements.map((m) => keys.map((k) => m[k] ?? ""))];
  const cad = [
    [
      "GRUPO",
      "TIPO",
      "CATEGORIA",
      "SUBCATEGORIA/NOME",
      "HODÔMETRO INICIAL",
      "HODÔMETRO ATUAL",
      "KM RODADOS",
      "PADRÃO",
      "ATIVO",
    ],
    ...registers.map((r) => [
      "SUBCATEGORIA",
      r.tipo,
      r.categoria,
      r.subcategoria,
      "",
      "",
      "",
      r.padrao ? "SIM" : "NAO",
      "",
    ]),
    ...drivers.map((d) => [
      "MOTORISTA",
      "",
      "",
      d.nome,
      "",
      "",
      "",
      d.padrao ? "SIM" : "NAO",
      "",
    ]),
    ...vehicles.map((v) => {
      const z = vehicleSummary(v);
      return [
        "VEICULO",
        "",
        "",
        v.nome,
        z.initial,
        z.last,
        z.driven,
        v.padrao ? "SIM" : "NAO",
        v.ativo === false ? "NAO" : "SIM",
      ];
    }),
  ];
  const res = [
    [
      "VEÍCULO",
      "CUSTO BRUTO",
      "RECEITAS",
      "CUSTO LÍQUIDO",
      "DISTÂNCIA KM",
      "CUSTO/KM",
      "KM/DIA",
      "CUSTO/DIA",
    ],
  ];
  [...vehicles.map((v) => v.nome), "TOTAL"].forEach((v) => {
    const s = stats(v === "TOTAL" ? movements : filtered(v));
    res.push([
      v,
      s.cost,
      s.income,
      s.net,
      s.km,
      s.km ? s.net / s.km : 0,
      s.km / s.days,
      s.net / s.days,
    ]);
  });
  res.push([], ["VEÍCULO", "GRUPO", "TOTAL"]);
  vehicles.forEach((v) =>
    Object.entries(groupTotals(filtered(v.nome))).forEach(([g, n]) =>
      res.push([v.nome, g, n]),
    ),
  );
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  );
  zip
    .folder("_rels")
    .file(
      ".rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    );
  zip
    .folder("xl")
    .file(
      "workbook.xml",
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimentos" sheetId="1" r:id="rId1"/><sheet name="Cadastros" sheetId="2" r:id="rId2"/><sheet name="Resumo" sheetId="3" r:id="rId3"/></sheets></workbook>',
    );
  zip
    .folder("xl")
    .folder("_rels")
    .file(
      "workbook.xml.rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
    );
  const ws = zip.folder("xl").folder("worksheets");
  ws.file("sheet1.xml", sheet(mov));
  ws.file("sheet2.xml", sheet(cad));
  ws.file("sheet3.xml", sheet(res));
  const blob = await zip.generateAsync({ type: "blob" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "meu_veiculo_exportacao.xlsx";
  a.click();
}
window.vehicleAppBridge = {
  getState: () => ({ movements, registers, drivers, vehicles }),
  applyState: (state) => {
    if (!state) return;
    movements = (state.movements || []).map((m, i) => normalizeMovement(m, i));
    registers = state.registers || defaults;
    drivers = state.drivers || [];
    vehicles = state.vehicles || [];
    recalculateDistances();
    save(false);
  },
};
$("#homeVersion").textContent = "v" + APP_VERSION;
const aboutVersion = [...$$("#sobre p")].find((p) =>
  p.textContent.trim().startsWith("Versão:"),
);
if (aboutVersion)
  aboutVersion.innerHTML = "<strong>Versão:</strong> " + APP_VERSION;
$("#exportXlsx").onclick = exportXlsx;

let deferredInstallPrompt = null;
const installButtons = () => $$(".install-app-action");
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
function refreshInstallControls() {
  const canInstall = Boolean(deferredInstallPrompt) && !isStandalone();
  installButtons().forEach((button) => {
    button.hidden = !canInstall;
  });
  const help = $("#installHelpText");
  if (help)
    help.textContent = isStandalone()
      ? "O Meu Veículo já está instalado neste aparelho."
      : canInstall
        ? "Toque no botão para instalar o aplicativo neste aparelho."
        : "No Chrome, use o menu e escolha Instalar aplicativo ou Adicionar à tela inicial.";
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refreshInstallControls();
});
installButtons().forEach((button) => {
  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    refreshInstallControls();
  });
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  refreshInstallControls();
});
refreshInstallControls();


function exportPdfReport() {
  const vehicle = $("#reportVehicle").value || "Todos os veículos";
  const ms = filterByPeriod(filtered($("#reportVehicle").value), "report"), s = stats(ms), groups = groupTotals(ms);
  const fuelRows = fuelReportData(ms), subRows = reportSubcategories(ms), expenses = ms.filter(m=>m.tipo!=="RECEITA").sort((a,b)=>(+b.valor||0)-(+a.valor||0));
  const gross = s.cost, maintenance = groups.Serviços || 0, admin = groups.Administrativo || 0, fuelCost = groups.Combustível || 0;
  const firstDate = ms.filter(m=>m.data_hora).sort((a,b)=>new Date(a.data_hora)-new Date(b.data_hora))[0]?.data_hora;
  const lastDate = ms.filter(m=>m.data_hora).sort((a,b)=>new Date(b.data_hora)-new Date(a.data_hora))[0]?.data_hora;
  const period = $("#reportPeriodLabel").textContent.replace(/^Período:\s*/, "") || "Geral";
  const diag = [];
  fuelRows.forEach(f => {
    if (f.n < 3) diag.push(`${f.name}: amostra insuficiente para avaliar tendência.`);
    else diag.push(`${f.name}: consumo ${f.trend.toLowerCase()} (${f.delta >= 0 ? "+" : ""}${num(f.delta,1)}% na média dos últimos abastecimentos em relação ao histórico do combustível).`);
  });
  const topSub = subRows[0]; if (topSub) diag.push(`Maior subcategoria por valor: ${topSub.name}, com ${money(topSub.total)}.`);
  const topExpense = expenses[0]; if (topExpense) diag.push(`Maior lançamento do período: ${topExpense.subcategoria || topExpense.categoria}, no valor de ${money(topExpense.valor)}.`);
  // Gera os gráficos com o mesmo veículo e período usados no relatório antes de capturá-los.
  renderNewCharts(ms);
  const reportGroups = groupTotals(ms), reportLabels = Object.keys(reportGroups), reportRaw = Object.values(reportGroups).map((v,i)=>reportLabels[i] === "Receitas" ? -v : v);
  const totalChart = withTotal(reportLabels, reportRaw), kmChart = withTotal(reportLabels, reportRaw.map(v=>s.km?v/s.km:0)), dayChart = withTotal(reportLabels, reportRaw.map(v=>s.days?v/s.days:0));
  drawChart($("#chartTotal"), totalChart.labels, totalChart.values, "money");
  drawChart($("#chartKm"), kmChart.labels, kmChart.values, "money");
  drawChart($("#chartDay"), dayChart.labels, dayChart.values, "money");
  const chartImage = id => { try { return $(id)?.toDataURL("image/png", 1) || ""; } catch { return ""; } };
  const reportCharts = [
    ["Consumo médio de combustível por semestre (km/L)", chartImage("#chartAnnualConsumption")],
    ["Evolução da quilometragem do veículo", chartImage("#chartOdometer")],
    ["Evolução do custo anual", chartImage("#chartMonthly")],
    ["Custo médio geral diário por ano", chartImage("#chartAnnualDaily")],
    ["Custo por categoria por quilômetro", chartImage("#chartKm")],
    ["Custo médio por categoria por dia", chartImage("#chartDay")],
    ["Custo total por categoria", chartImage("#chartTotal")],
    ["Top 10 subcategorias por valor", chartImage("#chartSubcategory")]
  ].filter(x=>x[1]);
  const chartsHtml = reportCharts.map(([title,src],i)=>`<section class="chart-print ${i===0?'page-break':''}"><h2>${escapeHtml(title)}</h2><img src="${src}" alt="${escapeHtml(title)}"></section>`).join("");
  const content = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Gerencial - ${escapeHtml(vehicle)}</title><style>
  @page{size:A4;margin:18mm 13mm 18mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#17324d;margin:0;background:#fff}header{background:#174f78;color:#fff;padding:18px 20px;border-radius:10px;margin-bottom:14px}header h1{margin:0;font-size:24px}header p{margin:5px 0 0}.meta{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-top:12px}.meta div{background:#ffffff18;padding:8px;border-radius:7px}.section{break-inside:avoid;margin:0 0 14px}.section h2{font-size:15px;color:#174f78;border-bottom:2px solid #2d7ca8;padding-bottom:5px;margin:12px 0 8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.card{border:1px solid #cbd9e3;border-radius:8px;padding:9px;min-height:58px}.card small{display:block;color:#5d7180;margin-bottom:5px}.card b{font-size:14px;color:#12395b}.note{background:#eef5f9;border-left:4px solid #2d7ca8;padding:9px;margin:8px 0}.warning{background:#fff5dd;border-left-color:#d59b18}table{width:100%;border-collapse:collapse;font-size:9.5px}th{background:#e8f1f6;color:#17324d;text-align:left}th,td{border-bottom:1px solid #d8e2e8;padding:6px 5px;vertical-align:top}td:nth-last-child(-n+3){white-space:nowrap}.num{text-align:right}.page-break{break-before:page}.footer{position:fixed;left:0;right:0;bottom:-12mm;border-top:1px solid #bacbd6;padding-top:4px;font-size:8px;color:#617480;display:flex;justify-content:space-between}.bar{height:7px;background:#dbe7ee;border-radius:5px;overflow:hidden;margin-top:4px}.bar i{display:block;height:100%;background:#2d7ca8}.diagnosis li{margin:4px 0}.muted{color:#617480}.chart-print{break-inside:avoid;margin:0 0 12px}.chart-print h2{font-size:14px;color:#174f78;border-bottom:2px solid #2d7ca8;padding-bottom:5px}.chart-print img{display:block;width:100%;max-height:82mm;object-fit:contain;border:1px solid #d8e2e8;border-radius:7px}@media print{button{display:none}}
  </style></head><body><header><h1>Meu Veículo</h1><p>Relatório Gerencial</p><div class="meta"><div><small>Veículo</small><br><b>${escapeHtml(vehicle)}</b></div><div><small>Período</small><br><b>${escapeHtml(period)}</b></div><div><small>Emissão</small><br><b>${reportDateTime()}</b></div></div></header>
  <section class="section"><h2>1. Resumo executivo</h2><div class="grid"><div class="card"><small>Distância percorrida</small><b>${intFmt(s.km)} km</b></div><div class="card"><small>Dias analisados</small><b>${intFmt(s.days)}</b></div><div class="card"><small>Média diária</small><b>${num(s.km/Math.max(s.days,1))} km</b></div><div class="card"><small>Custo bruto</small><b>${money(gross)}</b></div><div class="card"><small>Receitas</small><b>${money(s.income)}</b></div><div class="card"><small>Custo líquido</small><b>${money(s.net)}</b></div><div class="card"><small>Custo líquido/km</small><b>${money(s.km?s.net/s.km:0)}</b></div><div class="card"><small>Custo líquido/dia</small><b>${money(s.net/Math.max(s.days,1))}</b></div></div></section>
  <section class="section"><h2>2. Consumo e confiabilidade por combustível</h2>${fuelRows.length ? `<table><thead><tr><th>Combustível</th><th>Abastecimentos válidos</th><th>Participação no custo</th><th>Litros</th><th>Consumo histórico</th><th>Custo/km</th><th>Tendência</th><th>Confiabilidade</th></tr></thead><tbody>${fuelRows.map(f=>`<tr><th>${escapeHtml(f.name)}</th><td>${f.n}</td><td>${num(f.share,1)}%</td><td>${num(f.liters,2)}</td><td>${f.historical?num(f.historical,2)+' km/L':'—'}</td><td>${money(f.costKm)}</td><td>${escapeHtml(f.trend)}</td><td>${escapeHtml(f.confidence)}</td></tr>`).join('')}</tbody></table>`:'<p>Sem abastecimentos no período.</p>'}<div class="note warning"><b>Critério:</b> o consumo é avaliado separadamente por combustível e somente contra o histórico do próprio veículo. Combustíveis com poucos ciclos são exibidos, mas não recebem conclusão definitiva. O consolidado flex utiliza custo por km; não combina etanol e gasolina em uma única média de km/L.</div></section>
  ${chartsHtml}
  <section class="section page-break"><h2>3. Análise financeira por categoria</h2><table><thead><tr><th>Categoria</th><th class="num">Valor</th><th class="num">Participação nos gastos</th><th class="num">Custo/km</th><th class="num">Custo/dia</th></tr></thead><tbody>${[["Combustível",fuelCost],["Manutenção",maintenance],["Administrativo",admin]].map(([n,v])=>`<tr><th>${n}</th><td class="num">${money(v)}</td><td class="num">${num(gross?v/gross*100:0,1)}%</td><td class="num">${money(s.km?v/s.km:0)}</td><td class="num">${money(v/Math.max(s.days,1))}</td></tr>`).join('')}<tr><th>Total de gastos</th><td class="num"><b>${money(gross)}</b></td><td class="num">100,0%</td><td class="num">${money(s.km?gross/s.km:0)}</td><td class="num">${money(gross/Math.max(s.days,1))}</td></tr><tr><th>Receitas</th><td class="num">− ${money(s.income)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr><tr><th>Custo líquido</th><td class="num"><b>${money(s.net)}</b></td><td class="num">—</td><td class="num">${money(s.km?s.net/s.km:0)}</td><td class="num">${money(s.net/Math.max(s.days,1))}</td></tr></tbody></table></section>
  <section class="section page-break"><h2>4. Valor total por subcategoria</h2><table><thead><tr><th>Grupo</th><th>Subcategoria</th><th class="num">Qtde.</th><th class="num">% do grupo</th><th class="num">Valor total</th><th>Última ocorrência</th></tr></thead><tbody>${subRows.map(r=>`<tr><td>${escapeHtml(r.group)}</td><th>${escapeHtml(r.name)}</th><td class="num">${r.count}</td><td class="num">${num(r.share,1)}%</td><td class="num">${money(r.total)}</td><td>${r.last?new Date(r.last).toLocaleDateString('pt-BR'):'—'}</td></tr>`).join('')}</tbody></table></section>
  <section class="section"><h2>5. Maiores despesas</h2><table><thead><tr><th>Data</th><th>Grupo</th><th>Subcategoria</th><th class="num">Valor</th><th class="num">Hodômetro</th></tr></thead><tbody>${expenses.slice(0,10).map(m=>`<tr><td>${m.data_hora?new Date(m.data_hora).toLocaleDateString('pt-BR'):'—'}</td><td>${escapeHtml(m.categoria||m.tipo)}</td><th>${escapeHtml(m.subcategoria||'—')}</th><td class="num">${money(m.valor)}</td><td class="num">${+m.hodometro_km?intFmt(m.hodometro_km)+' km':'—'}</td></tr>`).join('')}</tbody></table></section>
  <section class="section"><h2>6. Diagnóstico histórico</h2><ul class="diagnosis">${diag.map(x=>`<li>${escapeHtml(x)}</li>`).join('') || '<li>Dados insuficientes para gerar observações.</li>'}</ul><div class="note"><b>Importante:</b> as classificações mostram apenas a evolução registrada no aplicativo. Elas não equivalem a diagnóstico mecânico nem comparam o veículo com dados de fábrica.</div></section>
  <section class="section"><h2>7. Informações do período</h2><p>Primeiro lançamento: <b>${firstDate?new Date(firstDate).toLocaleDateString('pt-BR'):'—'}</b> · Último lançamento: <b>${lastDate?new Date(lastDate).toLocaleDateString('pt-BR'):'—'}</b> · Total de lançamentos: <b>${ms.length}</b>.</p></section>
  <div class="footer"><span>Meu Veículo | v${APP_VERSION} | Desenvolvido por Marcelo Batista Ribeiro</span><span>Emitido em ${reportDateTime()}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return alert("Permita janelas pop-up para gerar o PDF.");
  win.document.write(content); win.document.close();
}
const pdfButton = $("#exportPdf"); if (pdfButton) pdfButton.onclick = exportPdfReport;
const themeButton = $("#themeToggle");
function applyTheme(mode) {
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (themeButton) themeButton.textContent = mode === "auto" ? "◐ Tema automático" : dark ? "☾ Tema escuro" : "☀ Tema claro";
  localStorage.setItem("mv_theme", mode);
}
if (themeButton) themeButton.onclick = () => { const current = localStorage.getItem("mv_theme") || "auto"; applyTheme(current === "auto" ? "light" : current === "light" ? "dark" : "auto"); };
applyTheme(localStorage.getItem("mv_theme") || "auto");
window.addEventListener("load", () => setTimeout(() => document.getElementById("splashScreen")?.classList.add("hidden"), 650));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) =>
      console.warn("Não foi possível registrar o service worker:", error),
    );
  });
}
load().then(() => {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("pagina");
  if (page && document.getElementById(page)) go(page);
  if (params.get("acao") === "novo") openEntry();
  if (page || params.has("acao"))
    history.replaceState(null, "", window.location.pathname + window.location.hash);
  window.vehicleAppReady = true;
  window.dispatchEvent(new Event("vehicle-app-ready"));
});
