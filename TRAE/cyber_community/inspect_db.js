// 遍历 cyber_community 数据库结构
// 从 .env.local 中加载 DATABASE_URL（dotenv 默认只读 .env，必须显式指定）
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: 缺少环境变量 DATABASE_URL');
  console.error('请在 .env.local 中设置，例如：');
  console.error('  DATABASE_URL=postgres://postgres:你的密码@127.0.0.1:5432/cyber_community');
  process.exit(1);
}

const { Client } = require('pg');
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  const out = (s) => console.log(s);

  out('===== 1. 数据库版本 & 当前库 =====');
  const v = await client.query("SELECT version()");
  out(v.rows[0].version);
  const db = await client.query("SELECT current_database(), current_user, current_schema()");
  out(JSON.stringify(db.rows[0]));

  out('\n===== 2. Schema 列表 =====');
  const schemas = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name`);
  out(schemas.rows.map(r => r.schema_name).join(', ') || '(仅 public)');

  out('\n===== 3. 所有表 / 视图 =====');
  const tables = await client.query(`
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY table_schema, table_name
  `);
  for (const r of tables.rows) {
    out(`  [${r.table_type}] ${r.table_schema}.${r.table_name}`);
  }

  out('\n===== 4. 每张表的列、主键、默认值、CHECK =====');
  for (const t of tables.rows) {
    if (t.table_type !== 'BASE TABLE') continue;
    out(`\n--- ${t.table_schema}.${t.table_name} ---`);
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position
    `, [t.table_schema, t.table_name]);
    for (const c of cols.rows) {
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` :
                  (c.numeric_precision ? `(${c.numeric_precision}${c.numeric_scale ? ','+c.numeric_scale : ''})` : '');
      out(`  ${c.column_name.padEnd(28)} ${c.udt_name}${len.padEnd(10)} ${c.is_nullable==='YES'?'NULL':'NOT NULL'} ${c.column_default?`DEFAULT ${c.column_default}`:''}`);
    }

    const pk = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema=$1 AND tc.table_name=$2 AND tc.constraint_type='PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [t.table_schema, t.table_name]);
    if (pk.rowCount) out(`  PK: (${pk.rows.map(r=>r.column_name).join(', ')})`);

    const uniq = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema=$1 AND tc.table_name=$2 AND tc.constraint_type='UNIQUE'
      ORDER BY kcu.ordinal_position
    `, [t.table_schema, t.table_name]);
    if (uniq.rowCount) {
      const groups = {};
      for (const r of uniq.rows) {
        // group by constraint_name via separate query
      }
      const uq = await client.query(`
        SELECT tc.constraint_name, array_agg(kcu.column_name ORDER BY kcu.ordinal_position) cols
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
        WHERE tc.table_schema=$1 AND tc.table_name=$2 AND tc.constraint_type='UNIQUE'
        GROUP BY tc.constraint_name
      `, [t.table_schema, t.table_name]);
      for (const r of uq.rows) out(`  UQ ${r.constraint_name}: (${r.cols.join(', ')})`);
    }

    const ck = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname=$1 AND rel.relname=$2 AND con.contype='c'
    `, [t.table_schema, t.table_name]);
    for (const r of ck.rows) out(`  CHECK ${r.conname}: ${r.def}`);

    const fk = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS fk_schema,
        ccu.table_name   AS fk_table,
        ccu.column_name  AS fk_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name=rc.constraint_name AND tc.table_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name=ccu.constraint_name AND rc.constraint_schema=ccu.constraint_schema
      WHERE tc.table_schema=$1 AND tc.table_name=$2 AND tc.constraint_type='FOREIGN KEY'
    `, [t.table_schema, t.table_name]);
    for (const r of fk.rows) {
      out(`  FK ${r.constraint_name}: (${r.column_name}) -> ${r.fk_schema}.${r.fk_table}(${r.fk_column}) ON UPDATE ${r.update_rule} ON DELETE ${r.delete_rule}`);
    }
  }

  out('\n===== 5. 索引（非主键/唯一自动产生的） =====');
  const idx = await client.query(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY schemaname, tablename, indexname
  `);
  for (const r of idx.rows) {
    out(`  ${r.schemaname}.${r.tablename} :: ${r.indexname}`);
    out(`     ${r.indexdef}`);
  }

  out('\n===== 6. 触发器 =====');
  const trg = await client.query(`
    SELECT event_object_schema AS schema, event_object_table AS table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2,3
  `);
  if (!trg.rowCount) out('  (none)');
  for (const r of trg.rows) {
    out(`  ${r.schema}.${r.table} :: ${r.trigger_name} [${r.action_timing} ${r.event_manipulation}] ${r.action_statement}`);
  }

  out('\n===== 7. 自定义函数/过程 =====');
  const fn = await client.query(`
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS rettype,
           CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'agg' WHEN 'w' THEN 'window' ELSE p.prokind END AS kind
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2
  `);
  if (!fn.rowCount) out('  (none)');
  for (const r of fn.rows) out(`  ${r.schema}.${r.name}${r.args} -> ${r.rettype} (${r.kind})`);

  out('\n===== 8. 视图定义 =====');
  const vw = await client.query(`
    SELECT schemaname, viewname, definition
    FROM pg_views
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY 1,2
  `);
  if (!vw.rowCount) out('  (none)');
  for (const r of vw.rows) {
    out(`  ${r.schemaname}.${r.viewname}`);
    out(`     ${r.definition.replace(/\s+/g,' ').slice(0,400)}`);
  }

  out('\n===== 9. 行数统计 =====');
  for (const t of tables.rows) {
    if (t.table_type !== 'BASE TABLE') continue;
    try {
      const c = await client.query(`SELECT COUNT(*)::int AS n FROM "${t.table_schema}"."${t.table_name}"`);
      out(`  ${t.table_schema}.${t.table_name}: ${c.rows[0].n} 行`);
    } catch (e) {
      out(`  ${t.table_schema}.${t.table_name}: 统计失败 (${e.message})`);
    }
  }

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
