import { z } from 'zod';

// const TextPartSchema = z.object({
//     type: z.literal('text'),
//     text: z.string().describe('Markdown or plain text response.'),
// });

// // Custom UI part: structured card
// const CardPartSchema = z.object({
//     type: z.literal('card'), // or 'data-card'
//     title: z.string(),
//     subtitle: z.string().optional(),
//     imageUrl: z.string().optional(),
//     fields: z.array(
//         z.object({
//             label: z.string(),
//             value: z.string(),
//         })
//     ).optional(),
//     actionUrl: z.string().optional(),
// });


// Custom UI part: clickable options
const OptionsPartSchema = z.object({
    type: z.literal('options'), // or 'data-options' if matching AI SDK DataUIPart strictly
    prompt: z.string().optional().describe('Optional label above the choices.'),
    options: z.array(
        z.object({
            id: z.string(),
            label: z.string().describe('Button text shown to the user.'),
            value: z.string().describe('Payload or message sent back when clicked.'),
        })
    ).min(1),
});

const PartNumberElementSchema = z.object({
    type: z.literal('partNumber'),
    source: z
        .enum(['genuine', 'oem', 'aftermarket'])
        .optional()
        .describe('Indicates whether the part is Genuine, OEM, or Aftermarket.'),
    manufacturer: z
        .string()
        .optional()
        .describe('Optional brand or manufacturer name (e.g., Bosch, Denso, Toyota).'),
    label: z.string().optional().describe('Optional label for the copy button.'),
    value: z.string().describe('The part number string to be displayed and copied.'),
    description: z.string().optional().describe('Optional description or tooltip for the copy button.'),
});


const VehicleDataSchema = z.object({
    type: z.literal('vehicle'),
    vin: z.string().describe('VIN of the vehicle from the search query, or "" if unknown.'),
    image: z.string().nullable().describe('Image URL of the vehicle from the search query, if known.'),
    make: z.string().nullable(),
    model: z.string().nullable(),
    yearFrom: z.number().nullable(),
    yearTo: z.number().nullable(),
    generation: z.string().nullable(),
    trim: z.string().nullable(),
    bodyType: z.string().nullable(),
    doors: z.number().nullable(),
    fuelType: z.string().nullable(),
    sources: z.array(z.string()).optional().describe('Sources of the vehicle data, if any, whether its tool or search ..etc.'),
});


const PartsDataSchema = z.array(
    z.object({
        id: z.string().describe('Unique identifier for the part.'),
        status: z.string().describe('The current status of the part (e.g., active, inactive).'),
        sku: z.string().describe('Stock Keeping Unit identifier.'),
        name: z.string().describe('The primary name of the part.'),
        description: z.string().describe('Additional details, or empty string if none.'),
        brand: z.string().describe('Manufacturer or brand name, or empty string if unknown.'),
        price: z.number().describe('The selling price of the part.'),
        quantity: z.number().describe('Current stock quantity available.'),
    })
);

// Top-level response schema
export const responseSchema = z.object({
    content: z.array(
        z.discriminatedUnion('type', [
            // TextPartSchema,
            // FilePartSchema,
            OptionsPartSchema,
            PartNumberElementSchema,
            // partsDataSchema,
            // CardPartSchema,
        ])
    ).describe('Ordered UI blocks that make up the assistant response.'),
    vehicle: VehicleDataSchema.nullable().describe(
        'Vehicle identified so far. Fill on every response with everything known, null for unknown fields. ' +
        'make, model and yearFrom must all be set before any part search.'
    ),
    parts: PartsDataSchema.nullable().describe(
        'Parts data returned from the parts search tool. Null if no search has been performed yet.'
    ),
});