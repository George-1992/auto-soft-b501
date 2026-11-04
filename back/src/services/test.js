import { nanoid } from 'nanoid';
import makesAndModels from '../../data/vehicleMakes.json' with { type: 'json' };
import Prisma from '#src/db/prisma/index.js';

export const TestFunc = async ({ req, res }) => {
    let resObj = {
        success: true,
        message: 'Test successful',
        data: null,
    }
    try {

        console.log('========= TestFunc called =========');
        // return res.send(resObj);

        console.log('makesAndModels: ', makesAndModels.length);

        const toSaveData = [];

        makesAndModels.forEach((item, index) => {
            let d = {
                id: nanoid(25),
                name: item.makeName,
                models: item.models.map(model => {
                    return {
                        id: nanoid(25),
                        name: model.modelName,
                    };
                }),
            }
            toSaveData.push(d);
        });

        // console.log('toSaveData: ', toSaveData[0]);

        // Save to database using Prisma
        for (const make of toSaveData) { // Limit to first 5 for testing
            const dateNow = new Date();
            await Prisma.vehicleMakes.create({
                data: {
                    id: make.id,
                    name: make.name,
                    createdAt: dateNow,
                    updatedAt: dateNow,
                    models: {
                        createMany: {
                            data: make.models.map(model => ({
                                id: model.id,
                                name: model.name,
                                createdAt: dateNow,
                                updatedAt: dateNow,
                            })),
                        }
                    },
                },
            });
        }

        console.log('Data saved to database successfully.');

        return res.send(resObj);
    } catch (error) {
        console.error('Error in test service:', error);
        resObj.success = false;
        resObj.message = 'An error occurred while processing the test request.';
        resObj.data = error.message || error;
        return res.status(500).send(resObj);
    }
}