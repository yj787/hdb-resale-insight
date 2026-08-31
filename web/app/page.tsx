'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Building2, CalendarDays, CheckCircle2, Database,
  Gauge, Info, Layers3, LoaderCircle, MapPin, ShieldCheck, Sparkles, TrendingUp,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Point = { month: string; price?: number; price_per_sqm: number; transactions?: number; lower?: number; upper?: number };
type Sale = { month: string; block: string; street: string; area: number; storey: string; price: number };
type MarketSeries = { history: Point[]; forecast: Point[]; recent: Sale[] };
type TrendPayload = { as_of: string; series: Record<string, MarketSeries> };
type Prediction = { predicted_price: number; lower_bound: number; upper_bound: number; currency: 'SGD' };

const towns = ['ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT MERAH', 'CLEMENTI', 'HOUGANG', 'JURONG WEST', 'PUNGGOL', 'QUEENSTOWN', 'SENGKANG', 'TAMPINES', 'TOA PAYOH', 'WOODLANDS', 'YISHUN'];
const flatTypes = ['2 ROOM', '3 ROOM', '4 ROOM', '5 ROOM', 'EXECUTIVE'];
const storeys = ['01 TO 03', '04 TO 06', '07 TO 09', '10 TO 12', '13 TO 15', '16 TO 18', '19 TO 21'];
const flatModels = ['Model A', 'Improved', 'New Generation', 'Premium Apartment', 'Simplified'];
const apiBaseUrl = (process.env.NEXT_PUBLIC_HDB_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const townComparison = [
  { town: 'QUEENSTOWN', value: 8950 }, { town: 'BUKIT MERAH', value: 8520 },
  { town: 'BISHAN', value: 7980 }, { town: 'TAMPINES', value: 6840 },
  { town: 'PUNGGOL', value: 6420 }, { town: 'WOODLANDS', value: 5680 },
];
const chartConfig = { actual: { label: '历史成交', color: '#087f6b' }, forecast: { label: '趋势预测', color: '#d5f36b' }, transactions: { label: '成交量', color: '#57b7a2' } } satisfies ChartConfig;

export default function Home() {
  const [town, setTown] = useState('TAMPINES');
  const [flatType, setFlatType] = useState('4 ROOM');
  const [area, setArea] = useState('93');
  const [storey, setStorey] = useState('07 TO 09');
  const [flatModel, setFlatModel] = useState('Model A');
  const [leaseYear, setLeaseYear] = useState('1995');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [trendData, setTrendData] = useState<TrendPayload | null>(null);
  const [trendTown, setTrendTown] = useState('TAMPINES');
  const [trendType, setTrendType] = useState('4 ROOM');

  useEffect(() => { fetch('/data/trends.json').then((r) => r.json()).then(setTrendData).catch(() => setTrendData(null)); }, []);
  const format = (value: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(value);
  const estimatePrice = async () => {
    const floorArea = Number(area);
    const commenceYear = Number(leaseYear);
    if (!Number.isFinite(floorArea) || floorArea < 20 || floorArea > 300 || !Number.isInteger(commenceYear) || commenceYear < 1960 || commenceYear > 2026) {
      setPredictionError('请检查面积（20–300㎡）和租约起始年份（1960–2026）。');
      return;
    }
    setIsPredicting(true);
    setPredictionError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ town, flat_type: flatType, floor_area_sqm: floorArea, storey_range: storey, flat_model: flatModel, lease_commence_date: commenceYear }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `接口返回 ${response.status}`);
      }
      setPrediction(await response.json() as Prediction);
    } catch (error) {
      setPrediction(null);
      setPredictionError(error instanceof Error ? `估价失败：${error.message}` : '估价失败：模型服务暂不可用');
    } finally {
      setIsPredicting(false);
    }
  };
  const selectedSeries = trendData?.series[`${trendTown}|${trendType}`];
  const chartData = useMemo(() => {
    if (!selectedSeries) return [];
    return [
      ...selectedSeries.history.map((point) => ({ ...point, actual: point.price_per_sqm })),
      ...selectedSeries.forecast.map((point) => ({ ...point, forecast: point.price_per_sqm })),
    ];
  }, [selectedSeries]);
  const latest = selectedSeries?.history.at(-1);
  const future = selectedSeries?.forecast.at(-1);
  const trendGrowth = latest && future ? ((future.price_per_sqm / latest.price_per_sqm - 1) * 100) : 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071d1a]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#estimate" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#d5f36b] text-[#071d1a]"><Building2 className="size-4.5" /></span><span><strong className="block text-sm tracking-tight">HDB Resale Insight</strong><small className="hidden text-[9px] uppercase tracking-[.2em] text-emerald-100/55 sm:block">Singapore housing intelligence</small></span></a>
          <nav className="hidden items-center gap-7 text-sm text-emerald-50/65 md:flex"><a href="#estimate" className="hover:text-white">价格估算</a><a href="#trends" className="hover:text-white">地区趋势</a><a href="#transactions" className="hover:text-white">相似成交</a><a href="#method" className="hover:text-white">模型说明</a></nav>
          <Badge className="border border-white/10 bg-white/5 text-emerald-50/75"><span className="size-1.5 rounded-full bg-[#d5f36b]" />截至 2026-07</Badge>
        </div>
      </header>

      <section id="estimate" className="relative overflow-hidden bg-[#071d1a] px-5 pb-16 pt-11 text-white sm:px-8 sm:pb-20 sm:pt-16">
        <div className="city-grid absolute inset-0 opacity-45" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl"><p className="mb-4 flex items-center gap-2 text-sm font-medium text-[#d5f36b]"><Sparkles className="size-4" />基于 239,330 笔官方 HDB 转售交易</p><h1 className="font-heading text-4xl font-semibold leading-[1.06] tracking-[-.045em] sm:text-6xl">找到一套房的<br />合理价格范围</h1><p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/65">输入地段、户型、面积、楼层和租约信息，得到当前合理价格、校准区间及相似成交参考。</p></div>
            <div className="grid grid-cols-3 gap-2 text-center"><HeroStat value="0.9523" label="测试集 R²" /><HeroStat value="4.95%" label="测试集 MAPE" /><HeroStat value="6个月" label="时间外测试" /></div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.12fr_.88fr]">
            <Card className="border-0 bg-white py-0 text-[#10211e] shadow-[0_30px_90px_rgba(0,0,0,.25)] ring-0">
              <CardHeader className="border-b border-stone-100 px-6 py-5 sm:px-7"><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="size-5 text-[#087f6b]" />房屋条件</CardTitle></CardHeader>
              <CardContent className="grid gap-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3 sm:px-7">
                <Field label="地段 / Town"><Choice value={town} onChange={setTown} options={towns} /></Field>
                <Field label="户型"><Choice value={flatType} onChange={setFlatType} options={flatTypes} /></Field>
                <Field label="建筑面积"><div className="relative"><Input value={area} onChange={(event) => setArea(event.target.value)} type="number" min="20" max="300" className="h-11 border-stone-200 bg-stone-50 pr-12" /><span className="absolute right-3 top-3 text-sm text-stone-400">㎡</span></div></Field>
                <Field label="楼层范围"><Choice value={storey} onChange={setStorey} options={storeys} /></Field>
                <Field label="房屋模型"><Choice value={flatModel} onChange={setFlatModel} options={flatModels} /></Field>
                <Field label="租约起始年份"><Input value={leaseYear} onChange={(event) => setLeaseYear(event.target.value)} type="number" min="1960" max="2026" className="h-11 border-stone-200 bg-stone-50" /></Field>
                <Button onClick={estimatePrice} disabled={isPredicting} className="h-12 bg-[#087f6b] text-white hover:bg-[#066a5a] sm:col-span-2 lg:col-span-3">{isPredicting ? <><LoaderCircle className="mr-2 size-4 animate-spin" />模型计算中</> : <>估算合理价格 <ArrowRight className="ml-1 size-4" /></>}</Button>
                {predictionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2 lg:col-span-3">{predictionError}</p>}
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-[#0c2a25]/92 py-0 text-white shadow-none ring-0">
              <CardHeader className="border-b border-white/10 px-6 py-5 sm:px-7"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.14em] text-emerald-50/40">Estimated resale value</p><CardTitle className="mt-1 text-sm font-medium text-emerald-50/70">预测中位价格</CardTitle></div><Badge className="bg-[#d5f36b]/15 text-[#d5f36b]">CatBoost API</Badge></div></CardHeader>
              <CardContent className="px-6 py-7 sm:px-7">{prediction ? <><p className="font-heading text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{format(prediction.predicted_price)}</p><p className="mt-2 text-sm text-emerald-50/50">约 {format(prediction.predicted_price / Math.max(Number(area), 1))} / ㎡</p><div className="mt-7"><div className="mb-2 flex items-center justify-between text-sm"><span className="text-emerald-50/55">合理价格区间</span><span>校准区间</span></div><div className="relative h-2 rounded-full bg-white/10"><div className="absolute left-[8%] right-[7%] h-full rounded-full bg-gradient-to-r from-[#4fd1b5] to-[#d5f36b]" /><span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0c2a25] bg-white" /></div><div className="mt-3 flex justify-between font-mono text-sm"><span>{format(prediction.lower_bound)}</span><span>{format(prediction.upper_bound)}</span></div></div></> : <div className="grid min-h-40 place-items-center text-center"><div><Gauge className="mx-auto mb-3 size-8 text-[#d5f36b]" /><p className="font-medium">等待真实模型估价</p><p className="mt-2 text-xs text-emerald-50/45">填写左侧条件后调用 CatBoost 推理服务</p></div></div>}<div className="mt-7 grid grid-cols-2 gap-3"><Metric icon={<Gauge />} label="测试集 MAPE" value="4.95%" /><Metric icon={<ShieldCheck />} label="区间覆盖率" value="77.6%" /></div><p className="mt-5 flex gap-2 text-xs leading-5 text-emerald-50/45"><Info className="mt-0.5 size-3.5 shrink-0" />结果由 FastAPI 调用已训练 CatBoost 模型生成；服务异常时不会以演示公式替代。</p></CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="trends" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl"><SectionHead eyebrow="Market trends" title="地区价格走势与未来 12 个月" description="以每平方米成交中位价消除不同户型面积结构带来的部分偏差，并显示趋势预测区间。" />
          <div className="mb-5 flex flex-wrap gap-3"><Choice value={trendTown} onChange={setTrendTown} options={towns} wide /><Choice value={trendType} onChange={setTrendType} options={flatTypes} wide /></div>
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <Card className="bg-white py-0 ring-stone-200"><CardHeader className="border-b px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{trendTown} · {trendType}</CardTitle><div className="flex gap-4 text-xs text-stone-500"><Legend color="#087f6b" label="历史成交" /><Legend color="#d5f36b" label="趋势预测" /></div></div></CardHeader><CardContent className="px-3 py-5 sm:px-5"><ChartContainer config={chartConfig} className="h-[330px] w-full aspect-auto"><AreaChart data={chartData} margin={{ left: 8, right: 12 }}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#087f6b" stopOpacity={.25} /><stop offset="95%" stopColor="#087f6b" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={34} tickFormatter={(value) => String(value).slice(2)} /><YAxis tickLine={false} axisLine={false} width={46} domain={['auto', 'auto']} tickFormatter={(value) => `${Math.round(Number(value) / 100) / 10}k`} /><ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <div className="flex min-w-36 justify-between gap-4"><span>{name === 'actual' ? '历史成交' : '趋势预测'}</span><strong>S${Number(value).toLocaleString()}/㎡</strong></div>} />} /><ReferenceLine x={selectedSeries?.history.at(-1)?.month} stroke="#9ca3af" strokeDasharray="4 4" /><Area type="monotone" dataKey="actual" stroke="#087f6b" strokeWidth={2.4} fill="url(#actualFill)" connectNulls /><Area type="monotone" dataKey="forecast" stroke="#b4d53e" strokeWidth={2.4} strokeDasharray="5 4" fill="transparent" connectNulls /></AreaChart></ChartContainer></CardContent></Card>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><Insight icon={<TrendingUp />} label="未来 12 个月趋势" value={`${trendGrowth >= 0 ? '+' : ''}${trendGrowth.toFixed(1)}%`} note="模型趋势估计，不代表保证收益" /><Insight icon={<Layers3 />} label="最近月中位价" value={latest ? `S$${latest.price_per_sqm.toLocaleString()}/㎡` : '载入中'} note={latest ? `${latest.transactions ?? 0} 笔成交` : '正在读取官方数据'} /><Insight icon={<CalendarDays />} label="预测区间" value="12 个月" note="包含季节性与残差波动" /></div>
          </div>
        </div>
      </section>

      <section className="border-y bg-[#edf5f1] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-center"><div><SectionHead eyebrow="Town comparison" title="不同地段，每平方米价格差异明显" description="Town 是模型中最重要的类别特征之一。同样的户型和面积，在成熟社区与非成熟社区会呈现不同的价格水平。" /><div className="mt-6 grid grid-cols-2 gap-3"><SmallFact value="26" label="Town 覆盖" /><SmallFact value="125" label="地区×户型序列" /></div></div><Card className="bg-white ring-stone-200"><CardContent className="pt-4"><ChartContainer config={chartConfig} className="h-[330px] w-full aspect-auto"><BarChart data={townComparison} layout="vertical" margin={{ left: 16, right: 18 }}><CartesianGrid horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="town" width={95} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => <strong>S${Number(value).toLocaleString()}/㎡</strong>} />} /><Bar dataKey="value" fill="#087f6b" radius={[0, 6, 6, 0]} /></BarChart></ChartContainer><p className="px-2 pb-1 text-xs text-stone-400">示意对比；正式版将根据所选月份和户型动态计算。</p></CardContent></Card></div>
      </section>

      <section id="transactions" className="px-5 py-16 sm:px-8 sm:py-24"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionHead eyebrow="Comparable sales" title="查看同地区近期真实成交" description="用实际交易帮助用户理解模型结果，而不是只给出一个无法核对的数字。" /><Badge variant="outline" className="h-7 px-3">{trendTown} · {trendType}</Badge></div><Card className="mt-7 bg-white py-0 ring-stone-200"><Table><TableHeader><TableRow className="bg-stone-50"><TableHead className="pl-5">月份</TableHead><TableHead>地址</TableHead><TableHead>面积</TableHead><TableHead>楼层</TableHead><TableHead className="pr-5 text-right">成交价</TableHead></TableRow></TableHeader><TableBody>{(selectedSeries?.recent ?? []).slice(0, 6).map((sale, index) => <TableRow key={`${sale.month}-${sale.block}-${index}`}><TableCell className="pl-5 font-mono text-stone-500">{sale.month}</TableCell><TableCell><strong className="font-medium">BLK {sale.block}</strong><span className="ml-2 text-xs text-stone-400">{sale.street}</span></TableCell><TableCell>{sale.area} ㎡</TableCell><TableCell>{sale.storey}</TableCell><TableCell className="pr-5 text-right font-mono font-semibold">{format(sale.price)}</TableCell></TableRow>)}{!selectedSeries && <TableRow><TableCell colSpan={5} className="h-28 text-center text-stone-400">正在载入成交记录…</TableCell></TableRow>}</TableBody></Table></Card></div></section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24"><figure className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#087f6b]/10 bg-[#071d1a] shadow-[0_25px_70px_rgba(7,29,26,.16)]"><img src="/og.png" alt="HDB Resale Insight：新加坡组屋与房价趋势数据视觉" className="aspect-[1200/630] w-full object-cover" /></figure></section>

      <section id="method" className="bg-[#071d1a] px-5 py-16 text-white sm:px-8 sm:py-24"><div className="mx-auto max-w-7xl"><SectionHead dark eyebrow="Model & data" title="数字背后的方法与边界" description="模型表现采用未来月份测试，而不是随机打乱数据；所有限制都在界面中明确说明。" /><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Method icon={<Database />} title="官方开放数据" text="使用 data.gov.sg 2017 年起的 HDB 转售登记数据，下载版本共 239,330 条。" /><Method icon={<BarChart3 />} title="CatBoost 回归" text="对数价格建模，处理 Town、户型、楼层范围与房屋模型等类别变量。" /><Method icon={<CalendarDays />} title="时间外测试" text="最后 6 个完整月份作为测试集，避免未来交易信息泄漏到训练过程。" /><Method icon={<ShieldCheck />} title="校准价格区间" text="使用独立校准集残差构造区间；80% 名义区间实测覆盖率为 77.6%。" /></div><div className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:flex sm:items-start sm:gap-4"><Info className="mb-3 size-5 shrink-0 text-[#d5f36b] sm:mb-0" /><p className="text-sm leading-6 text-emerald-50/60"><strong className="text-white">适用边界：</strong>官方数据没有具体单元号、装修、朝向、景观和买卖双方条件，因此结果是相似房屋的合理转售区间，不是对某一具体单元的保证报价。地区趋势属于统计预测，不构成投资建议。</p></div></div></section>

      <footer className="border-t border-white/10 bg-[#071d1a] px-5 py-7 text-emerald-50/45 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs sm:flex-row"><p>HDB Resale Insight · Portfolio machine learning project</p><p>Data: Housing & Development Board via data.gov.sg</p></div></footer>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-stone-600"><span>{label}</span>{children}</label>; }
function Choice({ value, onChange, options, wide = false }: { value: string; onChange: (value: string) => void; options: string[]; wide?: boolean }) { return <Select value={value} onValueChange={(next) => onChange(next ?? value)}><SelectTrigger className={`${wide ? 'min-w-44' : ''} h-11 w-full border-stone-200 bg-white`}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>; }
function HeroStat({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-3"><strong className="block font-mono text-lg text-[#d5f36b]">{value}</strong><span className="mt-1 block text-[10px] leading-4 text-emerald-50/45">{label}</span></div>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/[.04] p-3"><div className="mb-3 flex size-7 items-center justify-center rounded-lg bg-white/10 text-[#d5f36b] [&_svg]:size-3.5">{icon}</div><p className="text-xs text-emerald-50/45">{label}</p><p className="mt-1 font-mono text-lg font-semibold">{value}</p></div>; }
function SectionHead({ eyebrow, title, description, dark = false }: { eyebrow: string; title: string; description: string; dark?: boolean }) { return <div className="max-w-2xl"><p className={`mb-3 text-xs font-semibold uppercase tracking-[.18em] ${dark ? 'text-[#d5f36b]' : 'text-[#087f6b]'}`}>{eyebrow}</p><h2 className={`font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl ${dark ? 'text-white' : ''}`}>{title}</h2><p className={`mt-4 max-w-xl text-sm leading-6 ${dark ? 'text-emerald-50/55' : 'text-stone-500'}`}>{description}</p></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded-full" style={{ background: color }} />{label}</span>; }
function Insight({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <Card className="bg-white ring-stone-200"><CardContent><div className="mb-5 grid size-9 place-items-center rounded-xl bg-[#e4f2ed] text-[#087f6b] [&_svg]:size-4.5">{icon}</div><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-mono text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs leading-5 text-stone-400">{note}</p></CardContent></Card>; }
function SmallFact({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-[#087f6b]/10 bg-white/70 p-4"><strong className="font-mono text-2xl text-[#087f6b]">{value}</strong><span className="mt-1 block text-xs text-stone-500">{label}</span></div>; }
function Method({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="mb-5 grid size-9 place-items-center rounded-xl bg-[#d5f36b]/15 text-[#d5f36b] [&_svg]:size-4.5">{icon}</div><h3 className="font-medium">{title}</h3><p className="mt-2 text-xs leading-5 text-emerald-50/50">{text}</p><CheckCircle2 className="mt-5 size-4 text-[#4fd1b5]" /></div>; }
