import { nanoid } from 'nanoid';
import makesAndModels from '../../data/vehicleMakes.json' with { type: 'json' };
import Prisma from '#src/db/prisma/index.js';
import { Client } from 'pg';
const VPIC_URL = process.env.VPIC_DATABASE_URL || 'postgresql://vpic_db_user:db123456789@localhost:5432/vpic_db';
const pgClient = new Client({ connectionString: VPIC_URL });

export const TestFunc = async ({ req, res }) => {
    const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;
    let pgClient;
    let resObj = {
        success: true,
        message: 'Test successful',
        data: null,
    }
    try {

        console.log('========= TestFunc called =========');
        // return res.send(resObj);

        // console.log('makesAndModels: ', makesAndModels.length);
        // const toSaveData = [];
        // makesAndModels.forEach((item, index) => {
        //     let d = {
        //         id: nanoid(25),
        //         name: item.makeName,
        //         models: item.models.map(model => {
        //             return {
        //                 id: nanoid(25),
        //                 name: model.modelName,
        //             };
        //         }),
        //     }
        //     toSaveData.push(d);
        // });
        // // console.log('toSaveData: ', toSaveData[0]);
        // // Save to database using Prisma
        // for (const make of toSaveData) { // Limit to first 5 for testing
        //     const dateNow = new Date();
        //     await Prisma.vehicleMakes.create({
        //         data: {
        //             id: make.id,
        //             name: make.name,
        //             createdAt: dateNow,
        //             updatedAt: dateNow,
        //             models: {
        //                 createMany: {
        //                     data: make.models.map(model => ({
        //                         id: model.id,
        //                         name: model.name,
        //                         createdAt: dateNow,
        //                         updatedAt: dateNow,
        //                     })),
        //                 }
        //             },
        //         },
        //     });
        // }
        // console.log('Data saved to database successfully.');


        // resObj = await getSchemaVpic(makesAndModels);
        // resObj = await processVpic(makesAndModels);
        // resObj = await getSchemaVpic2();


        return res.send(resObj);
    } catch (error) {
        console.error('Error in test service:', error);
        resObj.success = false;
        resObj.message = 'An error occurred while processing the test request.';
        resObj.data = error.message || error;
        return res.status(500).send(resObj);
    } finally {
        if (pgClient) {
            await pgClient.end();
        }
    }
};


const getSchemaVpic = async () => {
    try {
        await pgClient.connect();
        const { rows } = await pgClient.query(`
            SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY table_schema, table_name, ordinal_position
        `);

        const tables = {};
        for (const r of rows) {
            const key = `${r.table_schema}.${r.table_name}`;
            (tables[key] ||= []).push({
                column_name: r.column_name,
                data_type: r.data_type,
                is_nullable: r.is_nullable,
            });
        }
        return { success: true, message: 'ok', data: tables };
    } catch (error) {
        return { success: false, message: 'Failed to fetch schema.', data: error.message };
    } finally {
        await pgClient.end();
    }
};

const getSchemaVpic2 = async () => {
    let resObj = { success: true, message: 'ok', data: null };
    try {
        //get all tables and columns from vpic schema
        await pgClient.connect();
        const { rows } = await pgClient.query(`
            SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'vpic'
            ORDER BY table_schema, table_name, ordinal_position
        `);


        // get one row from each table to see the data
        const perTableData = {};
        for (const r of rows) {
            const key = `${r.table_schema}.${r.table_name}`;

            if (!perTableData[key]) {
                const { rows: dataRows } = await pgClient.query(`SELECT * FROM ${key} LIMIT 1`);
                perTableData[key] = dataRows[0] || null;
            }

        }


        resObj.success = true;
        resObj.message = 'Successfully fetched schema.';
        resObj.data = { schema: rows, sampleData: perTableData };
        return resObj;

    } catch (error) {
        resObj.success = false;
        resObj.message = 'Failed to fetch schema.';
        resObj.data = error.message;
        return resObj;
    } finally {
        await pgClient.end();
    }
};

const processVpic = async ({ makeId = 449, modelId = null }) => {
    let pgClient;
    let resObj = { success: true, message: '', data: null };

    const groupBy = (rows, key) => {
        const m = new Map();
        for (const r of rows) {
            if (!m.has(r[key])) m.set(r[key], []);
            m.get(r[key]).push(r);
        }
        return m;
    };

    try {
        const dbUrl = 'postgresql://vpic_db_user:db123456789@localhost:5432/vpic_db';
        pgClient = new Client({ connectionString: dbUrl });
        await pgClient.connect();
        const q = async (sql, params = []) => (await pgClient.query(sql, params)).rows;

        const [make] = await q('SELECT * FROM vpic.make WHERE id = $1', [makeId]);
        if (!make) {
            resObj.success = false;
            resObj.message = `No make found with makeId: ${makeId}`;
            return resObj;
        }

        const models = await q(
            `SELECT m.*, mm.id AS make_model_id
             FROM vpic.make_model mm
             JOIN vpic.model m ON m.id = mm.modelid
             WHERE mm.makeid = $1 AND ($2::int IS NULL OR m.id = $2::int)
             ORDER BY m.name`,
            [makeId, modelId || null]
        );
        if (models.length === 0) {
            resObj.success = false;
            resObj.message = `No models found for makeId: ${makeId}`;
            return resObj;
        }
        const modelIds = models.map(m => m.id);

        const manufacturers = await q(
            `SELECT mf.* FROM vpic.manufacturer_make mmk
             JOIN vpic.manufacturer mf ON mf.id = mmk.manufacturerid
             WHERE mmk.makeid = $1`,
            [makeId]
        );

        const wmis = await q(
            `SELECT w.*, c.name AS country, vt.name AS vehicle_type
             FROM vpic.wmi w
             LEFT JOIN vpic.country c ON c.id = w.countryid
             LEFT JOIN vpic.vehicletype vt ON vt.id = w.vehicletypeid
             WHERE w.makeid = $1
                OR w.id IN (SELECT wmiid FROM vpic.wmi_make WHERE makeid = $1)`,
            [makeId]
        );
        const wmiIds = wmis.map(w => w.id);

        const wmiVinSchemas = await q('SELECT * FROM vpic.wmi_vinschema WHERE wmiid = ANY($1)', [wmiIds]);
        const vinSchemaIds = [...new Set(wmiVinSchemas.map(r => r.vinschemaid))];
        const vinSchemas = await q('SELECT * FROM vpic.vinschema WHERE id = ANY($1)', [vinSchemaIds]);
        const patterns = await q('SELECT * FROM vpic.pattern WHERE vinschemaid = ANY($1)', [vinSchemaIds]);

        // Vehicle spec schemas (this is the per model data)
        const specSchemas = await q('SELECT * FROM vpic.vehiclespecschema WHERE makeid = $1', [makeId]);
        const specSchemaIds = specSchemas.map(s => s.id);
        const specModels = await q(
            'SELECT * FROM vpic.vehiclespecschema_model WHERE vehiclespecschemaid = ANY($1) AND modelid = ANY($2)',
            [specSchemaIds, modelIds]
        );
        const specYears = await q('SELECT * FROM vpic.vehiclespecschema_year WHERE vehiclespecschemaid = ANY($1)', [specSchemaIds]);
        const vSpecSchemaPatterns = await q('SELECT * FROM vpic.vspecschemapattern WHERE schemaid = ANY($1)', [specSchemaIds]);
        const vSpecPatterns = await q(
            'SELECT * FROM vpic.vehiclespecpattern WHERE vspecschemapatternid = ANY($1)',
            [vSpecSchemaPatterns.map(p => p.id)]
        );

        // Resolve (elementid, attributeid) to readable values through element.lookuptable
        const allAttrs = [...patterns, ...vSpecPatterns];
        const elementIds = [...new Set(allAttrs.map(p => p.elementid))];
        const elements = Object.fromEntries(
            (await q('SELECT * FROM vpic.element WHERE id = ANY($1)', [elementIds])).map(e => [e.id, e])
        );
        const existingTables = new Set(
            (await q("SELECT tablename FROM pg_tables WHERE schemaname = 'vpic'")).map(r => r.tablename)
        );

        const idsByLookup = {};
        for (const p of allAttrs) {
            const lt = elements[p.elementid]?.lookuptable?.toLowerCase();
            if (lt && existingTables.has(lt)) {
                (idsByLookup[lt] ||= new Set()).add(String(p.attributeid));
            }
        }
        const lookups = {};
        for (const [lt, ids] of Object.entries(idsByLookup)) {
            const rows = await q(
                `SELECT id, name FROM vpic."${lt.replace(/"/g, '""')}" WHERE id::text = ANY($1)`,
                [[...ids]]
            );
            lookups[lt] = Object.fromEntries(rows.map(r => [String(r.id), r.name]));
        }

        const resolve = (p) => {
            const el = elements[p.elementid];
            const lt = el?.lookuptable?.toLowerCase();
            return {
                elementId: p.elementid,
                element: el?.name ?? null,
                code: el?.code ?? null,
                lookupTable: el?.lookuptable ?? null,
                attributeId: p.attributeid,
                value: (lt && lookups[lt]?.[String(p.attributeid)]) ?? p.attributeid,
            };
        };

        // Assemble VIN schemas
        const patternsBySchema = groupBy(patterns, 'vinschemaid');
        const wmiVsBySchema = groupBy(wmiVinSchemas, 'vinschemaid');
        const wmiById = Object.fromEntries(wmis.map(w => [w.id, w]));
        const vinSchemasOut = vinSchemas.map(vs => ({
            ...vs,
            wmis: (wmiVsBySchema.get(vs.id) || []).map(r => ({
                yearfrom: r.yearfrom,
                yearto: r.yearto,
                orgid: r.orgid,
                wmi: wmiById[r.wmiid]?.wmi ?? r.wmiid,
            })),
            patterns: (patternsBySchema.get(vs.id) || []).map(p => ({
                id: p.id,
                keys: p.keys,
                ...resolve(p),
            })),
        }));

        // Assemble spec schemas per model
        const vspByPatternId = groupBy(vSpecPatterns, 'vspecschemapatternid');
        const vspBySchema = groupBy(vSpecSchemaPatterns, 'schemaid');
        const yearsBySchema = groupBy(specYears, 'vehiclespecschemaid');
        const specById = Object.fromEntries(specSchemas.map(s => [s.id, s]));
        const specsByModel = groupBy(specModels, 'modelid');

        const buildSpec = (schemaId) => ({
            ...specById[schemaId],
            years: (yearsBySchema.get(schemaId) || []).map(y => y.year),
            patternGroups: (vspBySchema.get(schemaId) || []).map(g => ({
                id: g.id,
                attributes: (vspByPatternId.get(g.id) || []).map(p => ({
                    iskey: p.iskey,
                    ...resolve(p),
                })),
            })),
        });

        const modelsOut = models.map(m => ({
            ...m,
            specSchemas: (specsByModel.get(m.id) || []).map(r => buildSpec(r.vehiclespecschemaid)),
        }));

        const filteredModels = modelsOut.filter(m => m.name === 'C-Class');
        const result = filteredModels.map(m => ({
            id: m.id,
            name: m.name,
            variants: buildModelVariants(m),
        }));

        console.log('all modelsOut:', modelsOut.length);
        console.log('filtered modelsOut:', filteredModels.length);

        const makesOut = [{
            id: make.id,
            name: make.name,
            models: result,
        }];

        resObj.message = 'Successfully fetched make data.';
        resObj.data = {
            makes: makesOut,
            rowData: filteredModels
        };

        return resObj;
    } catch (error) {
        console.error('Error in processVpic service:', error);
        resObj.success = false;
        resObj.message = 'An error occurred while processing the vehicle data request.';
        resObj.data = error.message || error;
        return resObj;
    } finally {
        if (pgClient) await pgClient.end();
    }
};






const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
const pick = (group, code) => group.attributes.find(a => a.code === code)?.value ?? null;
const mapBody = (v) => {
    const s = String(v || '').toLowerCase();
    if (!s) return null;
    if (s.includes('sedan') || s.includes('saloon')) return 'sedan';
    if (s.includes('wagon') || s.includes('estate')) return 'wagon';
    if (s.includes('hatchback')) return 'hatchback';
    if (s.includes('coupe')) return 'coupe';
    if (s.includes('convertible') || s.includes('cabriolet') || s.includes('roadster')) return 'convertible';
    if (s.includes('sport utility') || s.includes('suv') || s.includes('crossover')) return 'suv';
    if (s.includes('van')) return 'van';
    if (s.includes('pickup')) return 'pickup';
    return null;
};
const mapFuel = (v) => {
    const s = String(v || '').toLowerCase();
    if (!s) return null;
    if (s.includes('diesel')) return 'diesel';
    if (s.includes('gasoline') || s.includes('petrol')) return 'petrol';
    if (s.includes('electric') && !s.includes('hybrid')) return 'electric';
    if (s.includes('hybrid')) return 'hybrid';
    if (s.includes('compressed natural')) return 'cng';
    if (s.includes('liquefied petroleum')) return 'lpg';
    return null;
};
const mapTrans = (v) => {
    const s = String(v || '').toLowerCase();
    if (!s) return null;
    if (s.includes('manual')) return 'manual';
    if (s.includes('automatic') || s.includes('cvt') || s.includes('dual')) return 'automatic';
    return null;
};
const mapDrive = (v) => {
    const s = String(v || '').toUpperCase();
    if (s.startsWith('FWD')) return 'fwd';
    if (s.startsWith('RWD')) return 'rwd';
    if (s.startsWith('AWD')) return 'awd';
    if (s.startsWith('4WD')) return 'fourWd';
    return null;
};
const buildModelVariants = (m) => {
    const out = new Map();
    for (const schema of m.specSchemas) {
        const years = schema.years.map(Number).filter(Boolean);
        if (!years.length) continue;
        const yMin = Math.min(...years);
        const yMax = Math.max(...years);

        for (const g of schema.patternGroups) {
            const cc = toNum(pick(g, 'DisplacementCC'));
            const l = toNum(pick(g, 'DisplacementL'));
            const kw = toNum(pick(g, 'EngineKW'));
            const hp = toNum(pick(g, 'EngineHP'));
            const turbo = String(pick(g, 'Turbo') || '').toLowerCase() === 'yes';

            const row = {
                source: 'vpic',
                externalId: null,
                kType: null,
                generation: null,
                aliases: [],
                trim: pick(g, 'Trim') || pick(g, 'Series'),
                yearFrom: yMin,
                yearTo: yMax,
                bodyType: mapBody(pick(g, 'BodyClass')),
                doors: toNum(pick(g, 'Doors')),
                fuelType: mapFuel(pick(g, 'FuelTypePrimary')),
                engineCode: pick(g, 'EngineModel'),
                displacement: cc ?? (l ? Math.round(l * 1000) : null),
                displacementL: l ?? (cc ? Math.round(cc / 100) / 10 : null),
                powerKw: kw ?? (hp ? Math.round(hp * 0.7457) : null),
                powerHp: hp ?? (kw ? Math.round(kw / 0.7457) : null),
                cylinders: toNum(pick(g, 'EngineCylinders')),
                valves: null,
                aspiration: turbo ? 'turbo' : null,
                transmission: mapTrans(pick(g, 'TransmissionStyle')),
                driveType: mapDrive(pick(g, 'DriveType')),
                steeringSide: 'lhd',
            };

            const { yearFrom, yearTo, ...sig } = row;
            const key = JSON.stringify(sig);
            const ex = out.get(key);
            if (ex) {
                ex.yearFrom = Math.min(ex.yearFrom, yearFrom);
                ex.yearTo = Math.max(ex.yearTo, yearTo);
            } else {
                row.externalId = `${m.id}:${schema.id}:${g.id}`;
                out.set(key, row);
            }
        }
    }
    return [...out.values()];
};