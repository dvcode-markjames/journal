# Consistency Journal (React + TypeScript + Supabase)

One sheet per trading account. Each account stores its own account size, growth target,
consistency limit and reward share. Daily P/L, cumulative P/L, running best day, rule check
and the weekly summary are calculated for you.

## Setup
1. Create a project at supabase.com.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the Project URL and the anon public key.
4. `cp .env.example .env` and paste both values.
5. `npm install` then `npm run dev`.
6. (Optional) Authentication > Providers > Email: turn off "Confirm email" while testing.

## How the numbers work (same as your spreadsheet)
- Total net profit = sum of daily P/L
- Highest profitable day = max(0, best daily P/L)
- Consistency = highest profitable day / total net profit
- Growth target ($) = account size x growth target
- Ready = total >= growth target AND consistency <= consistency limit
- Max best-day profit = total x consistency limit
- Reward share = total x reward share (only when total is positive)
