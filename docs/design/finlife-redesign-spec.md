# FinLife Tracker — UI Redesign Spec

> ไฟล์นี้เป็นสเปกสำหรับให้ Claude Code นำไปปรับ UI ของแอป FinLife Tracker
> Mockup ครบทุกหน้าอยู่บน Design canvas "FinLife Dashboard Redesign" (https://claude.ai/artifact/JE5EZKJEwhruZGDrXN8fPU — เปิดได้เฉพาะเจ้าของบัญชี ถ้า Claude Code เปิดไม่ได้ ให้ยึดตามสเปกในไฟล์นี้)

---

## 0. วิธีใช้ไฟล์นี้ (อ่านก่อนเริ่ม)

- **ขอบเขต:** ปรับ UI ของทุกหน้าที่มีอยู่ ได้แก่ Dashboard, Transactions, Wallets, Debt Payoff, Daily Diary และ Categories ส่วน Smart Rules ให้ใช้ token และ component ชุดเดียวกัน แต่ไม่ต้องเปลี่ยนการทำงาน
- **ห้ามเปลี่ยน data model หรือ API** ยกเว้นตรรกะที่ระบุไว้ในหัวข้อ 5 ซึ่งส่วนใหญ่เป็นการคำนวณฝั่ง UI หรือ selector
- **ก่อนแก้โค้ด** ให้สำรวจโครงสร้างโปรเจกต์ก่อน ดู framework, วิธี styling (Tailwind, CSS modules ฯลฯ) และ component ที่มีอยู่ แล้วเอา token ในหัวข้อ 1 ใส่ในระบบที่โปรเจกต์ใช้อยู่ เช่น `tailwind.config` หรือ CSS variables ไม่ต้องเพิ่ม library UI ใหม่
- **ทำเป็นเฟส** ตามหัวข้อ 9 ทำเสร็จทีละเฟสแล้วรัน build/test ให้ผ่านก่อนไปเฟสถัดไป
- ข้อความ UI ยังคงเป็นภาษาอังกฤษเหมือนเดิม ส่วนข้อมูลของผู้ใช้ที่เป็นภาษาไทยต้องแสดงได้ถูกต้อง

---

## 1. Design tokens

ใส่เป็น CSS variables ที่ `:root` หรือ map เข้า theme ของ Tailwind ห้าม hard-code hex ใน component

```css
:root {
  /* Surfaces */
  --bg-page: #0B0E14;
  --bg-header: #0F131B;
  --bg-card: #131722;
  --bg-inset: #0F131B;        /* กล่องย่อยในการ์ด, input */
  --bg-raised: #1A1F2B;       /* dropdown / menu */
  --bg-control-active: #262B3A; /* segmented control ที่ถูกเลือก */

  /* Borders */
  --border: #1F2532;          /* การ์ด, เส้นแบ่ง, track ของ progress bar */
  --border-control: #252B38;  /* ปุ่ม secondary, input */
  --border-strong: #2A3140;   /* dashed, menu */

  /* Text (contrast วัดบน --bg-card) */
  --text-1: #E8EAF0;  /* 14.9:1 */
  --text-2: #A3AABB;  /* 7.7:1 */
  --text-3: #8A93A6;  /* 5.8:1  — caption ห้ามจางกว่านี้ */
  --text-disabled: #4A5163;

  /* Semantic: ความหมายของเงิน */
  --income: #34D399;   --income-bg: #0F2A21;
  --expense: #F87171;  --expense-bg: #2E1719;
  --transfer: #38BDF8; --transfer-bg: #0E2533;
  --adjust: #A3AABB;   --adjust-bg: #1E2233;
  --warning: #FBBF24;  --warning-bg: #231C0B; --warning-border: #4A3A12; --warning-text: #F3E3B5;

  /* Action (ม่วง = ปุ่มหลักและสถานะที่ถูกเลือกเท่านั้น) */
  --primary: #7C3AED;          /* ตัวหนังสือขาวบนพื้นนี้ 5.7:1 */
  --primary-hover: #6D28D9;
  --primary-ring: #8B5CF6;
  --primary-soft-bg: #1E1A33;  /* nav ที่ active, ปุ่ม secondary-accent */
  --primary-soft-border: #3A3160;
  --primary-soft-text: #D4C4FF;
  --selected-bg: #251E45;      /* ตัวเลือกที่ถูกเลือกในฟอร์ม */
  --link: #B79CFF;  --link-hover: #D4C4FF;

  /* Radius */
  --r-card: 16px; --r-inner: 12px; --r-control: 10px; --r-button: 8px; --r-pill: 999px;
}
```

### Identity palette (สีประจำกระเป๋าเงินและหมวดหมู่)

เป็นสีหม่นที่ต่างกันทั้ง hue และความสว่าง **ห้ามใช้แดง เขียว ฟ้า cyan หรือเหลืองอำพัน** เพราะสีเหล่านั้นสงวนไว้ให้ความหมายของเงิน

```
#D9A066 tan      #6C8EEF blue     #4FB7A8 teal
#F59E6B peach    #E879A6 rose     #7DA2F0 periwinkle
#B69CF5 lavender #5CC8B8 aqua     #C7B38A khaki
#8FA8C8 steel    #D98FD0 orchid   #9C8CD9 iris
System categories: #6B7385
```

ไอคอนของกระเป๋าใช้ tile ที่เป็นสีเดียวกันแต่เข้มมาก เป็นพื้นหลัง แล้วใช้สีเต็มกับเส้นของไอคอน เช่น Cash ใช้พื้น `#2E2418` กับเส้น `#D9A066`, Main ใช้ `#1A2140` กับ `#6C8EEF` และ Sub ใช้ `#13302C` กับ `#4FB7A8`

---

## 2. Typography

- ฟอนต์: **IBM Plex Sans Thai** น้ำหนัก 400/500/600/700 จาก Google Fonts รองรับทั้งไทยและอังกฤษในตระกูลเดียว
- **เลิกใช้ monospace กับตัวเลข** ให้ตั้ง `font-variant-numeric: tabular-nums` ที่ `body` แทน ตัวเลขจะยังตรงหลักเหมือนเดิม

| ใช้กับ | ขนาด / น้ำหนัก |
|---|---|
| Page title (h1) | 26px / 600 |
| Card title (h2) | 17px / 600 |
| Section label | 12–13px / 600, uppercase, letter-spacing 0.4px, สี `--text-2` หรือ `--text-3` |
| Body | 14px / 400–500 |
| Caption | 12–13px, สี `--text-3` |
| Hero number (Net worth) | 44px / 600, letter-spacing −1px |
| KPI number | 28px / 600 |
| จำนวนเงินในแถวรายการ | 15px / 600 |

---

## 3. กฎการใช้สี

| สี | ใช้กับ | ห้ามใช้กับ |
|---|---|---|
| เขียว `--income` | รายรับ, ยอดบวก, progress ของการจ่ายหนี้ | สีประจำกระเป๋าหรือหมวดหมู่ |
| แดง `--expense` | รายจ่าย, ยอดหนี้ที่ค้าง, ปุ่มลบ | สีประจำกระเป๋า, แถบสัดส่วน |
| ฟ้า `--transfer` | การโอนระหว่างกระเป๋าของตัวเอง | อย่างอื่น |
| เทา `--adjust` | Balance adjustment, หมวดของระบบ | — |
| ม่วง `--primary` | ปุ่มหลัก 1 ปุ่มต่อพื้นที่, nav ที่ active, ตัวเลือกที่ถูกเลือก | ตกแต่ง |
| เหลืองอำพัน `--warning` | เรื่องที่ต้องแก้จริงเท่านั้น | ค่าปกติ เช่น "Avg food" |

กฎเพิ่มเติม:

- **การ์ดใช้ขอบกลางๆ เสมอ** (`--border`) ห้ามทำขอบการ์ดเป็นสีเขียวหรือแดง ให้สีอยู่ที่ตัวเลขเท่านั้น
- ยอด Net หรือ Left over ใช้ `--text-1` ถ้าเป็นบวก และใช้ `--expense` ถ้าติดลบ ไม่ใช้เขียวเหมือนรายรับ
- **สถานะที่ถูกเลือกต้องหน้าตาเดียวกันทั้งแอป** คือพื้น `--selected-bg` ขอบ `--primary-ring` และตัวหนังสือขาว ส่วน segmented control ใช้ `--bg-control-active`

---

## 4. Shared components

สร้างหรือปรับ component ชุดนี้ก่อน แล้วค่อยนำไปใช้ในทุกหน้า

1. **AppHeader** สูง 64px ใช้พื้น `--bg-header` และเส้นขอบล่าง `--border` ภายในมีองค์ประกอบดังนี้
   - โลโก้กับชื่อ "FinLife"
   - nav 6 แท็บ **อยู่ชิดซ้ายต่อจากโลโก้** ไม่กระจายเต็มความกว้าง แท็บที่ active ใช้พื้น `--primary-soft-bg` สีตัวอักษร `--primary-soft-text` และมี `aria-current="page"`
   - ด้านขวามีสถานะ Synced เป็นจุดเขียวกับข้อความ, icon button สองปุ่มที่ต้องมี `aria-label` และ `title` ("Display settings" กับ "Account") และปุ่มหลัก "Add entry"
   - **เอายอด TOTAL BALANCE ออกจาก header** เพราะซ้ำกับ Dashboard
   - ต้องไม่มี header ซ้อนกันสองชั้นตอนเลื่อนหน้า (ในภาพหน้าจอเดิมมี sticky header ซ้อน 2 ชั้น) header ต้อง sticky ชั้นเดียว
2. **PageHeader** มี h1 และคำอธิบายหนึ่งบรรทัดทางซ้าย ส่วนทางขวาเป็นปุ่ม action ของหน้านั้น ไม่ต้องห่อด้วยการ์ด
3. **Card** ใช้พื้น `--bg-card`, ขอบ 1px `--border`, radius 16 และ padding 24–28 ส่วนกล่องย่อยข้างในใช้ `--bg-inset` กับ radius 12
4. **Button** มี 4 แบบ
   - `primary`: พื้นม่วงตัวหนังสือขาว
   - `secondary`: พื้นโปร่ง ขอบ `--border-control`
   - `soft`: ใช้ `--primary-soft-*`
   - `danger`: ตัวหนังสือ `--expense` ขอบ `#4A2227`
   - ความสูง 40px สำหรับปุ่มใน header และ 44px สำหรับปุ่มในการ์ด เป้าคลิกต้องไม่ต่ำกว่า 44px บนมือถือ
5. **IconButton** ขนาด 40×40 และต้องมี `aria-label` เสมอ
6. **SegmentedControl** เป็นกล่อง `--bg-card` ที่มีขอบ ตัวเลือกที่ถูกเลือกใช้ `--bg-control-active` สีขาวตัวหนา และมี `aria-pressed` หรือ `role="tab"`
7. **Chip / Tag** มีจุดสีขนาด 7px อยู่หน้าชื่อหมวด ใช้พื้น `--adjust-bg` สีตัวอักษร `#C9CFDC` และ radius pill สีของหมวดอยู่ที่จุดเท่านั้น ห้ามใช้เป็นพื้นของ chip
8. **Amount**: ฟังก์ชันจัดรูปแบบเงินให้ใช้ร่วมกันทั้งแอป
   - ใช้รูปแบบ `฿1,234.56` และเครื่องหมายลบต้องเป็น `−` (U+2212)
   - รายรับแสดง `+฿` สีเขียว และรายจ่ายแสดง `−฿` สีแดง
   - Transfer แสดง `฿` โดยไม่มีเครื่องหมายและใช้สีฟ้า แต่ถ้าอยู่ในมุมมองของกระเป๋าใดกระเป๋าหนึ่ง ให้แสดง `+` หรือ `−` ตามทิศทางเข้าหรือออกจากกระเป๋านั้น
   - Adjustment แสดง `+` หรือ `−` เป็นสีเทา
   - ไม่ต้องแสดงคำว่า "THB" ต่อท้ายทุกตัวเลข ให้แสดงเฉพาะที่ hero number
9. **TransactionRow** ประกอบด้วย
   - icon tile ขนาด 36px ใช้พื้นและเส้นตามชนิดรายการ ได้แก่ ↙ รายรับ, ↗ รายจ่าย, ⇄ โอน, และ +/− ปรับยอด **ใช้ไอคอนชุดเดียวกันทุกหน้า**
   - ชื่อรายการ และบรรทัดรองที่บอกกระเป๋าหรือทิศการโอน เช่น "Main → Cash"
   - chip หมวดหมู่ และจำนวนเงิน
   - ทั้งแถวคลิกได้เพื่อแก้ไข
10. **DayGroupHeader** แสดงวันที่ในรูป "Sun, Sep 27" หรือ "Yesterday · Sun, Sep 27" คู่กับยอดสุทธิของวันนั้นทางขวา การคำนวณดู L11
11. **ProgressBar** มี track `--border` สูง 5–10px และส่วนที่เติมเป็นสีตามบริบท
12. **AllocationBar** เป็นแถบเดียวแบ่งช่องตามสัดส่วนของแต่ละกระเป๋า เว้นช่องห่าง 3px และแต่ละช่องใช้สีประจำกระเป๋า
13. **WarningBanner** ใช้พื้น `--warning-bg` ขอบ `--warning-border` มีไอคอนสามเหลี่ยม ข้อความ และลิงก์ action ใช้ `role="note"`
14. **OverflowMenu (⋯)** ใช้เก็บ action อันตรายหรือ action ที่ใช้ไม่บ่อย เช่น Delete และ Archive เมนูใช้พื้น `--bg-raised` และรายการ Delete เป็นสีแดง

---

## 5. การเปลี่ยนตรรกะ (สำคัญ ต้องทำให้ตัวเลขตรงกันทั้งแอป)

- **L1 · ความหมายของ "Spending"** ตัวเลขรายจ่ายและกราฟหมวดหมู่ **ไม่รวม** transaction ที่เป็น transfer, หมวด Debt Repayment และหมวด Balance Adjustment ให้ทำ selector กลางชื่อประมาณ `isSpending(tx)` / `isIncome(tx)` แล้วใช้ selector นี้ทุกที่ Income ก็ไม่รวม transfer และ adjustment เช่นกัน
- **L2 · ช่วงเวลาเดียวคุมทั้งหน้า** ปุ่ม Today / This week / Past 30 days / All time ย้ายไปอยู่ใน PageHeader ของ Dashboard แล้วเก็บค่าใน state หรือ store กลาง ทุกการ์ดบน Dashboard ต้องใช้ช่วงนี้ รวมถึง cash flow, หมวดหมู่ และ insight และต้องแสดงช่วงวันที่จริงกำกับ เช่น "Aug 29 – Sep 28" ในภาพหน้าจอเดิมมีตัวเลขรายจ่ายสามค่าที่ไม่ตรงกัน คือ 9,996.22, 15,673.43 และ 9,656.22 หลังแก้ต้องเหลือค่าเดียว
- **L3 · Net worth** คือผลรวมยอดของกระเป๋าที่ active ลบด้วยผลรวม remaining ของหนี้ที่ active
- **L4 · ยอดที่ต้องจ่ายต่อเดือนของหนี้แต่ละก้อน** คำนวณจาก `required = remaining / monthsLeft` โดย `monthsLeft = max(1, (due.year − today.year) * 12 + (due.month − today.month) − 1)` ซึ่งคือจำนวนเดือนเต็มที่เหลือก่อนถึงเดือนครบกำหนด ถ้าเลยกำหนดแล้วให้แสดงสถานะ "Overdue" เป็นสีแดง
  - ตัวอย่าง ณ วันที่ 28 ก.ย. 2026: SPayLater มี monthsLeft = 3 จึงต้องจ่าย 13,173.70 / 3 = 4,391.23 ส่วน SEasy Cash มี monthsLeft = 18 จึงต้องจ่าย 9,403.30 / 18 = 522.41
- **L5 · แจ้งเตือนเรื่องหนี้** ให้ `totalRequired` เป็นผลรวม required ของทุกหนี้ ถ้า `totalRequired` มากกว่า Income − Spending ของ 30 วันล่าสุด ให้แสดง WarningBanner บน Dashboard และแสดงกล่องเตือนในหน้า Debt Payoff พร้อมบอกยอดที่ขาด หนี้ก้อนที่ required มากกว่า surplus ให้แสดงยอด "Needed / month" เป็นสี warning
- **L6 · คำอธิบายสำรอง** ถ้า description ว่างหรือเป็นค่า default "Transaction" ให้แสดงชื่อหมวดแทน และบรรทัดรองแสดง "No description · <wallet>" ส่วนในฟอร์ม placeholder ของช่อง description ให้บอกว่าถ้าว่างจะใช้ชื่อหมวด
- **L7 · การแสดง transfer** แสดงเป็น "Transfer" พร้อมบรรทัดรอง "From → To" ไม่ต้องมี chip หมวดหมู่ ห้ามแสดง "No category"
- **L8 · รวมคู่ adjustment** ใน Recent activity ของ Dashboard และหน้า Wallet detail ถ้ามี Balance adjustment คู่หนึ่งที่อยู่ในกระเป๋าเดียวกัน วันเดียวกัน และยอดเท่ากันแต่เครื่องหมายตรงข้าม ให้ยุบเป็นแถวเดียว เช่น "2 balance adjustments on Cash that cancel out · net ฿0.00" แล้วกดเพื่อขยายดูได้ ส่วนหน้า Transactions ยังแสดงแยกทีละรายการเป็นสีเทา
- **L9 · สีหมวดหมู่ห้ามซ้ำ** ในตัวเลือกสีของฟอร์มหมวดหมู่ สีที่หมวดอื่นใช้อยู่แล้วต้อง disabled โดยตั้ง opacity 0.25 และใส่ `aria-label` ว่า "… used by X" จากนั้นทำ migration สีครั้งเดียวตามตาราง 5.1
- **L10 · หมวดของระบบ** Debt Repayment และ Balance Adjustment ต้องแสดงชื่อแบบอ่านง่าย ห้ามแสดงค่า enum ดิบอย่าง `DEBT_REPAYMENT` หรือ `ADJUSTMENT` ให้จัดอยู่ในกลุ่ม "System" แก้ไขและลบไม่ได้ (แสดงไอคอนกุญแจ) และมีคำอธิบายว่าไม่ถูกนับเป็นรายรับหรือรายจ่าย
- **L11 · ยอดสุทธิรายวัน** ใน DayGroupHeader ให้คำนวณจากผลรวมรายรับลบรายจ่ายตามนิยามใน L1 โดยไม่รวม transfer และ adjustment
- **L12 · Pagination** หน้า Transactions เปลี่ยนจากหน้าละ 8 รายการเป็นโหลดครั้งละ 25 รายการ พร้อมปุ่ม "Load 25 more"
- **L13 · หมวดของ adjustment** ต้องแสดง "Balance adjustment" เหมือนกันทุกหน้า ปัจจุบันบางหน้าแสดง "No category" และบางหน้าแสดง "General"

### 5.1 การ migrate สี

| หมวด / กระเป๋า | สีใหม่ |
|---|---|
| Food & Dining | `#E879A6` |
| Groceries | `#F59E6B` |
| Housing & Utilities | `#7DA2F0` |
| Shopping & Apparel | `#B69CF5` |
| Transport & Fuel | `#5CC8B8` |
| camel | `#C7B38A` |
| Primary Salary | `#8FA8C8` |
| Freelance & Side Gig | `#D98FD0` |
| กิจนิมนต์ | `#9C8CD9` |
| Debt Repayment, Balance Adjustment | `#6B7385` (system) |
| Wallet: Cash / Main / Sub | `#D9A066` / `#6C8EEF` / `#4FB7A8` |

ถ้าในระบบเก็บสีเป็นชื่อ preset ไม่ใช่ hex ให้แก้ตัวเลือก preset เป็น palette ชุดใหม่ใน 1 แล้ว map หมวดเดิมเข้ากับสีใหม่ตามตารางนี้

---

## 6. สเปกรายหน้า

เลย์เอาต์ของทุกหน้าใช้ความกว้างเต็มจอ padding ของ main เป็น 32px ด้านบน 40px ด้านข้าง และ 48px ด้านล่าง ใช้ grid 12 คอลัมน์ที่มี gap 16px และเว้นระยะระหว่าง section 24px

### 6.1 Dashboard

1. **PageHeader** ทางซ้ายเป็นคำทักทายกับวันที่ ทางขวาเป็น SegmentedControl ช่วงเวลา (ดู L2)
2. **แถว Hero** แบ่งเป็นสองการ์ด
   - การ์ด **Net worth** กว้าง 5/12 แสดงตัวเลขใหญ่ และมีกล่องย่อยสองกล่อง คือ "In N wallets" กับ "Debt remaining" ที่เป็นสีแดง
   - การ์ด **Cash flow** กว้าง 7/12 มี Income, Spending และ Left over ในการ์ดเดียว ขอบกลาง สีอยู่ที่ตัวเลขเท่านั้น ด้านล่างมีแถบ spent-vs-left และ caption "x% of income spent"
   - **ลบการ์ด Income/Expense/Net แบบเดิม 3 ใบที่มีขอบสีออก**
3. **WarningBanner** เรื่องหนี้ (ดู L5) แสดงเฉพาะเมื่อเข้าเงื่อนไข
4. **Wallets** ใช้หัวข้อธรรมดา ไม่ต้องห่อด้วยการ์ดเปล่าเหมือนเดิม
   - ทางขวาของหัวข้อมีลิงก์ Transfer และ Manage wallets
   - ด้านล่างเป็นการ์ดเดียวที่มี AllocationBar และรายการกระเป๋าแบบแถว 3 คอลัมน์ แต่ละแถวมี icon tile, ชื่อ, บรรทัด "type · share%", ยอดเงิน และลูกศร ›
   - **ลบ "Tap to inspect" และแถบ Share of Total ของแต่ละการ์ดออก**
5. **แถวหมวดหมู่และหนี้**
   - การ์ด **Spending by category** กว้าง 7/12 เป็นไปตาม L1 ทางขวาของหัวการ์ดแสดงยอดรวม มี caption ว่าไม่รวมอะไรบ้าง แต่ละแถวมีจุดสี ชื่อหมวด % และยอดเงิน ตามด้วย progress บาง 6px ในสีของหมวด
   - การ์ด **Debt payoff** กว้าง 5/12 มี progress รวม ตามด้วยหนี้แต่ละก้อนเป็นกล่องย่อยที่แสดงชื่อ, remaining เป็นสีแดง, progress, วันครบกำหนด และ required ต่อเดือน (ดู L4) ปิดท้ายด้วยปุ่ม soft "Make a repayment"
6. **แถวล่าง**
   - การ์ด **Recent activity** กว้าง 8/12 จัดกลุ่มตามวันตาม L8 และ L11 และมีลิงก์ View all
   - การ์ด **Mood & spending** กว้าง 4/12 ดึงข้อมูลจาก Diary แสดงวันที่ มูดเป็นแถบ 5 ขีด (ห้ามใช้ emoji) และยอดใช้จ่ายของวันนั้น ถ้า log น้อยกว่า 5 วันให้แสดงข้อความชวนให้บันทึกเพิ่ม ปิดท้ายด้วยปุ่ม "Log today (…)"
7. **ลบการ์ด "Monthly Spending Insights" แบบเดิม** แล้วย้าย insight ที่สำคัญไปเป็น WarningBanner แทน ถ้าจะเก็บการ์ดนี้ไว้ ตัวเลขในการ์ดต้องใช้ช่วงเวลาและนิยามเดียวกับการ์ดอื่นตาม L1 และ L2

### 6.2 Transactions

- **PageHeader** ใช้หัวข้อ "Transactions" และคำอธิบาย "Click any row to edit it" ทางขวามีปุ่ม secondary **"Import / export ▾"** ซึ่งเป็น dropdown ที่รวม Import CSV และ Export CSV กับปุ่ม primary "Add transaction"
  - **ย้ายปุ่ม Export Diary (JSON) ไปไว้หน้า Diary อย่างเดียว**
- **แถว Filter** เรียงตามนี้
  - ช่องค้นหาที่ยืดเต็มพื้นที่ที่เหลือ
  - dropdown ช่วงวันที่
  - dropdown กระเป๋า
  - dropdown หมวด
  - SegmentedControl ประเภท: All / Income / Expense / Transfer
  - checkbox "Show deleted"
- **Layout** ใช้ 8/12 กับ 4/12
  - **ฝั่งซ้ายเป็นรายการ** ในการ์ดเดียว แถวบนสุดเป็นสรุปของ filter ปัจจุบัน ได้แก่ ช่วงเวลา, In, Out และหมายเหตุว่าไม่นับ transfer และ adjustment ถัดมาเป็นรายการที่จัดกลุ่มด้วย DayGroupHeader ซึ่งใช้พื้น `--bg-inset` แต่ละแถวเป็น TransactionRow แถวที่กำลังแก้ไขอยู่ให้ใช้พื้น `#1C1930` และแถบซ้าย 3px สี `--primary-ring` ด้านล่างสุดมีปุ่ม "Load 25 more" ตาม L12
  - **ฝั่งขวาเป็นแผงแก้ไข** (Edit drawer) ซึ่งเป็นฟีเจอร์ใหม่ เพราะเดิมแก้ไขรายการไม่ได้เลย ภายในมีองค์ประกอบดังนี้
    - SegmentedControl ประเภท
    - ช่อง Amount ตัวใหญ่ 24px ที่เปลี่ยนสีตามประเภท
    - Description ที่ใช้ placeholder ตาม L6
    - Category และ Wallet วางคู่กัน ถ้าเป็นประเภท Transfer ให้เปลี่ยนเป็นช่อง From / To
    - Date
    - ปุ่ม "Save changes" แบบ primary คู่กับปุ่ม "Delete" แบบ danger
    - หมายเหตุว่ากู้คืนรายการที่ลบได้จาก "Show deleted"
  - ถ้ายังไม่ได้เลือกแถวใด แผงแก้ไขจะซ่อนอยู่ และรายการขยายเต็มความกว้าง ส่วนบนจอแคบให้แผงแก้ไขเปิดเป็น bottom sheet หรือ modal
- **ปุ่มถังขยะรายแถวให้เอาออก** แล้วใช้ปุ่ม Delete ในแผงแก้ไขแทน

### 6.3 Wallets

- **PageHeader** มีหัวข้อ "Wallets" และบรรทัดรอง "฿X across N wallets" ทางขวามีปุ่ม secondary "Transfer" ที่มีไอคอนสีฟ้า และปุ่ม primary "Add wallet"
- **Layout** เป็นแบบ master–detail สัดส่วน 4/12 กับ 8/12
  - **ฝั่งซ้าย** มี AllocationBar ตามด้วยรายการกระเป๋าเป็นการ์ดแถว กระเป๋าที่เลือกอยู่ใช้พื้น `#1C1930` และขอบ `#4B3F86` ท้ายรายการมีปุ่มเส้นประ "Add wallet"
  - **ฝั่งขวา** แสดงรายละเอียดของกระเป๋าที่เลือก
    - หัวการ์ดมี icon tile ขนาด 52px ชื่อกระเป๋า และบรรทัด "type · created <date>" ทางขวามีปุ่ม Edit และปุ่ม ⋯ ที่รวม Archive wallet กับ Delete wallet…
    - **ลบปุ่มถังขยะที่ลอยอยู่บนการ์ดแบบเดิม** และลบป้าย "Active Source" ออก
    - กล่องยอดเงินแสดง current balance ขนาด 40px คู่กับปุ่ม "Transfer out" และ "Adjust balance"
    - ส่วน "Recent activity in <wallet>" จัดกลุ่มตามวัน ใช้ Amount แบบมุมมองกระเป๋า (transfer มีเครื่องหมายตามทิศทาง) ตาม L8 และมีลิงก์ไปหน้า Transactions ที่กรองเฉพาะกระเป๋านี้ไว้แล้ว
- Delete wallet ต้องมี dialog ยืนยัน และต้องบอกว่าจะเกิดอะไรขึ้นกับ transaction ของกระเป๋านั้น

### 6.4 Debt Payoff

- **PageHeader** มีหัวข้อ "Debt payoff" และบรรทัด "N active debts · sorted by due date" ทางขวามีปุ่ม primary "Add debt"
- **การ์ดสรุป** แบ่งเป็น 3 คอลัมน์
  1. Still owed เป็นสีแดง และมีบรรทัด "of ฿X borrowed"
  2. Paid off แสดง % พร้อม progress และยอดที่จ่ายไปแล้วเป็นสีเขียว
  3. กล่อง warning "Needed per month to hit every due date" แสดง totalRequired และยอดที่ขาดตาม L5 ถ้าไม่ขาดให้เปลี่ยนเป็นกล่อง inset ธรรมดาที่เขียนว่า "On track"
- **การ์ดหนี้** จัดเป็นกริด 2 คอลัมน์และ **เรียงตามวันครบกำหนดที่ใกล้ที่สุดก่อน** แต่ละใบมีองค์ประกอบดังนี้
  - ชื่อหนี้กับ tag "Interest-free" หรืออัตราดอกเบี้ย และ tag "Due <date> · ~N months" ซึ่งจะเป็นสี warning ถ้าเข้าเงื่อนไข L5
  - ปุ่ม ⋯ ที่มี Edit กับ Delete
  - remaining เป็นสีแดงขนาด 28px, % ที่จ่ายแล้ว และ progress
  - กล่องย่อย 3 ช่อง ได้แก่ Borrowed, Repaid และ Needed / month
  - ปุ่ม primary "Make repayment" และปุ่ม secondary **"Mark as paid off"** ที่มีไอคอน ✓ ใช้แทนไอคอน ✓ ลอยๆ แบบเดิมที่ไม่มีคำอธิบาย
- ท้ายหน้ามี caption ว่ายอดผ่อนหนี้ไม่ถูกนับเป็นรายจ่าย

### 6.5 Daily Diary

- **PageHeader** มีหัวข้อ "Daily diary" ทางขวามีปุ่ม secondary "Export JSON" ซึ่งเป็นที่เดียวที่มีปุ่มนี้
- **Layout** ใช้ 7/12 กับ 5/12
  - **ฝั่งซ้ายเป็นฟอร์มบันทึก**
    - หัวการ์ดมีวันที่ "Monday, Sep 28" และบรรทัดรอง "Today · spent ฿X in N transactions so far" ทางขวามีปุ่ม ‹, "Pick date" และ › โดยปุ่ม › จะ disabled เมื่อเป็นวันนี้
    - **Mood** เป็นปุ่ม 5 ปุ่มที่มีตัวเลขกับคำกำกับ ได้แก่ Very low, Low, Neutral, Good และ Great ห้ามใช้ emoji และปุ่มที่ถูกเลือกใช้สไตล์ selected มาตรฐาน
    - **Activity** ใช้ตัวเลือกเดิมของแอป ใน mockup แสดงเป็น Rest day / Workout
    - **Meals** มีสามตัวเลือก คือ Clean / home, Average และ Fast food / junk **ทุกตัวเลือกใช้สไตล์ selected เดียวกัน** ห้ามใช้เขียวหรือส้มตามความดีหรือไม่ดีของอาหาร
    - ช่อง Notes และปุ่ม "Save entry" ซึ่งไม่ต้องใส่วันที่ซ้ำในชื่อปุ่ม
  - **ฝั่งขวามีสองการ์ด**
    1. **ปฏิทินเดือน** เริ่มสัปดาห์ที่วันจันทร์ วันที่ log แล้วใช้พื้น `#3B2F73` วันนี้มีขอบ `--primary-ring` วันในอนาคตเป็นสี `--text-disabled` คลิกที่วันเพื่อโหลดบันทึกของวันนั้นเข้าฟอร์ม มี legend และบอกจำนวนวันที่ log แล้วในเดือนนั้น
    2. **Recent entries** แต่ละรายการมีวันที่และยอดใช้จ่ายสีแดง มูดเป็นแถบ 5 ขีด บรรทัดสรุป "Neutral · Rest day · Average meals · N transactions" และ note ในกล่อง inset ถ้ามี ปุ่มลบให้ย้ายไปอยู่ในเมนู ⋯ ของแต่ละรายการ
- ลบ badge สีส้ม "Avg Food" และ emoji หน้ารายการออก

### 6.6 Categories

- **PageHeader** มีหัวข้อ "Categories" ทางขวามี SegmentedControl ที่ใช้ `role="tablist"` สำหรับสลับระหว่าง Categories กับ Smart rules
- **Layout** ใช้ 7/12 กับ 5/12
  - **ฝั่งซ้ายเป็นรายการ** แบ่งเป็น 3 กลุ่ม
    - **Expense** ใช้หัวข้อกลุ่มสีแดง
    - **Income** ใช้หัวข้อกลุ่มสีเขียว
    - **System** ใช้สีเทาตาม L10
    - แต่ละแถวมีจุดสี 12px ชื่อหมวด ป้าย "Default" หรือ "Custom · in use" และลูกศร › ทั้งแถวคลิกได้เพื่อแก้ไข จึงไม่ต้องมีปุ่มดินสอแยก
  - **ฝั่งขวาเป็นฟอร์ม "New category"**
    - SegmentedControl ประเภท Expense / Income วางไว้บนสุด
    - ช่อง Name และ Description พร้อมคำอธิบายว่าช่วยให้ auto-sort จำได้
    - ตัวเลือกสีเป็นกริด 6 คอลัมน์จาก identity palette 12 สี โดยสีที่ใช้แล้วจะ disabled ตาม L9
    - ปุ่ม "Add category"
- เมื่อคลิกแถวในรายการ ฟอร์มนี้จะเปลี่ยนเป็นโหมด "Edit category" ที่มีปุ่ม Save และ Delete โดยปุ่ม Delete ใช้ได้เฉพาะหมวดที่ไม่มีรายการใช้งานอยู่ หรือต้องให้เลือกหมวดปลายทางสำหรับย้ายรายการก่อนลบ

---

## 7. Accessibility

- ข้อความทุกชิ้นต้องมี contrast อย่างน้อย 4.5:1 และ `--text-3` เป็นสีที่จางที่สุดที่อนุญาต
- ใช้ `<button>`, `<a href>`, `<input>` + `<label>` ของจริง ห้ามใส่ `onClick` บน `div`
- Icon button ทุกตัวต้องมี `aria-label` ส่วน nav ที่ active ต้องมี `aria-current="page"` และตัวเลือกที่ถูกเลือกต้องมี `aria-pressed` หรือ `aria-selected`
- ห้ามสื่อความหมายด้วยสีอย่างเดียว ตัวเลขต้องมี `+`, `−` หรือไอคอนกำกับเสมอ
- ต้องมี focus ring ที่มองเห็นได้ ใช้ `outline: 2px solid var(--primary-ring); outline-offset: 2px`

## 8. Responsive

- **≥1280px** ใช้เลย์เอาต์ตาม mockup
- **768–1279px** grid ที่แบ่ง 7/5 และ 8/4 จะกลายเป็นคอลัมน์เดียว ส่วน hero ยังคงวาง 2 การ์ดคู่กัน
- **<768px**
  - header สูง 56px และ nav กลายเป็น bottom tab bar 5 แท็บ โดย Categories ย้ายไปอยู่ในเมนู Account
  - ทุกการ์ดเรียงเป็นคอลัมน์เดียว แถว wallet เรียงลงแนวตั้ง
  - แผงแก้ไขและฟอร์มต่างๆ เปิดเป็น bottom sheet
  - padding ด้านข้างของหน้าเหลือ 16px

## 9. ลำดับการทำ (เฟส)

1. **Foundation:** ทำ tokens ตามหัวข้อ 1, ฟอนต์และ tabular-nums, ฟังก์ชัน Amount และ AppHeader รวมถึงแก้ปัญหา header ซ้อน
2. **Logic:** ทำ L1–L13 เป็น selector กลางพร้อม unit test โดยใช้ตัวเลขตัวอย่างใน L4
3. **Shared components:** ทำหัวข้อ 4
4. **หน้า:** ทำตามลำดับ Dashboard → Transactions (รวมแผงแก้ไข) → Wallets → Debt Payoff → Daily Diary → Categories
5. **Migration สี** ตามหัวข้อ 5.1
6. **ตรวจงาน:** ไล่ checklist ในหัวข้อ 10

## 10. Acceptance checklist

- [ ] บน Dashboard ช่วงเวลาเดียวกันต้องให้ตัวเลข Spending ค่าเดียวในทุกการ์ด
- [ ] Debt Repayment, Balance Adjustment และ transfer ไม่ปรากฏในกราฟหมวดหมู่และไม่ถูกนับใน Spending
- [ ] Net worth = ยอดรวมกระเป๋า − ยอดหนี้คงเหลือ (จากข้อมูลตัวอย่างต้องได้ ฿9,595.48)
- [ ] ยอด Needed/month ของหนี้ตรงกับสูตรใน L4 และแถบเตือนแสดงเมื่อเข้าเงื่อนไข L5
- [ ] ไม่มีการ์ดใดใช้ขอบสีเขียว แดง หรือม่วง และสีแดงไม่ถูกใช้เป็นสีประจำกระเป๋าหรือหมวด
- [ ] ไม่มีค่า enum ดิบหรือข้อความ "Transaction", "No category", "General" หลุดมาถึง UI
- [ ] คลิกแถวใน Transactions แล้วแก้ไขและบันทึกได้ และลบแล้วกู้คืนได้
- [ ] ไอคอน transfer เหมือนกันทุกหน้า และรายการ transfer ไม่มีเครื่องหมายลบนอกมุมมองของกระเป๋า
- [ ] ตัวเลือกสีไม่ยอมให้เลือกสีที่หมวดอื่นใช้อยู่แล้ว
- [ ] สถานะที่ถูกเลือกของ Mood, Activity และ Meals หน้าตาเหมือนกัน และไม่มี emoji
- [ ] header มีชั้นเดียว และ icon button มี `aria-label`
- [ ] ผ่าน contrast 4.5:1 และใช้งานด้วยคีย์บอร์ดได้ครบ
- [ ] build และ test ที่มีอยู่เดิมยังผ่านทั้งหมด

## 11. สมมติฐานและเรื่องที่ต้องเช็กกับเจ้าของ

- ชื่อหนี้ "SPayLater" และ "SEasy Cash" อ่านจากภาพหน้าจอที่ถูกบังไปครึ่งหนึ่ง ให้ใช้ชื่อตามข้อมูลจริงในระบบ
- ตัวเลือกในหัวข้อ Activity ของ Diary มองไม่เห็นในภาพหน้าจอ ให้ใช้ตัวเลือกที่มีอยู่เดิมในโค้ด
- ความหมายของ icon button สองปุ่มใน header (รูปจอภาพกับรูปคน) เดาว่าเป็น Display settings กับ Account ให้ตั้งชื่อตามสิ่งที่ปุ่มทำจริง
- หน้า Smart Rules ไม่ได้ออกแบบใหม่ ให้ใช้ token และ component ชุดเดียวกันเท่านั้น
