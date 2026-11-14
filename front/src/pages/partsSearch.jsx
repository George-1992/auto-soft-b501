import { AiInput, MessagesRenderer, streamToData } from "@/src/components/ai/streamV2";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
import Image from "@/src/components/wraps/image";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { fileToBase64 } from "@/src/services/other";
import _ from "lodash";
import { CarIcon } from "lucide-react";
import { use, useEffect } from "react";
import { useState } from "react";

const dummyMessages = [
    {
        "role": "user",
        "content": "what fast food should i eat today ?"
    },
    {
        "role": "assistant",
        "content": "Quick pick: **Taco Bell** — go for a **Crunchwrap Supreme** (or a **Burrito** if you want something more filling).",
        "render": [
            {
                "type": "options",
                "title": "Want a different vibe?",
                "content": null,
                "image": null,
                "options": [
                    {
                        "id": "1",
                        "value": "Burgers (fast + filling)",
                        "image": null
                    },
                    {
                        "id": "2",
                        "value": "Chicken (crispy + comfort)",
                        "image": null
                    },
                    {
                        "id": "3",
                        "value": "Tacos/Mexican (fresh + customizable)",
                        "image": null
                    },
                    {
                        "id": "4",
                        "value": "Pizza-ish (cheesy + shareable)",
                        "image": null
                    },
                    {
                        "id": "5",
                        "value": "Salad/light (still satisfying)",
                        "image": null
                    }
                ]
            }
        ]
    },
    {
        "role": "user",
        "content": "Burgers (fast + filling)"
    },
    {
        "role": "assistant",
        "content": "For fast + filling burgers, I’d pick **Five Guys** (best “fill you up” energy) or **McDonald’s** if you want the quickest value.\n\n- **Five Guys:** Cheeseburger + share fries (very filling)\n- **McDonald’s:** Double Quarter Pounder (or Big Mac) + fries\n\nWant it more **cheap**, more **big/loaded**, or **healthier**?",
        "render": [
            {
                "type": "options",
                "title": "Which vibe today?",
                "content": null,
                "image": null,
                "options": [
                    {
                        "id": "cheap",
                        "value": "Cheap/value",
                        "image": null
                    },
                    {
                        "id": "loaded",
                        "value": "Big/loaded",
                        "image": null
                    },
                    {
                        "id": "healthier",
                        "value": "Healthier-ish",
                        "image": null
                    }
                ]
            }
        ]
    },
    {
        "role": "user",
        "content": "Healthier-ish"
    },
    {
        "role": "assistant",
        "content": "Try **Chick-fil-A**: a **Grilled Chicken Sandwich** (or grilled nuggets) + a side salad (skip or keep fries small).\n\nIf you want a classic burger vibe, go **Five Guys** but choose **single patties** and skip mayo/extra cheese; add **lettuce/tomato/pickles** instead.",
        "render": []
    },
    {
        "role": "user",
        "content": "what other options"
    },
    {
        "role": "assistant",
        "content": "Here are some other “healthier-ish” fast-food burger options:\n\n- **Shake Shack**: **ShackBurger** (skip extras) + **side salad** (or smaller fries)\n- **Wendy’s**: **Dave’s Single** (or single with no mayo) + **salad**\n- **BurgerFi**: **Boca/plant-based options** or simpler burger build + **side salad**\n- **Carl’s Jr./Hardee’s**: choose **Charbroiled** items (often lighter) and a **salad**\n- **In-N-Out**: **Protein Style** (lettuce wrap) to cut the bun calories + skip heavy sauces\n\nIf you tell me your location (US/UK/etc.) and whether you want **beef or chicken/plant-based**, I’ll narrow it to 2 best picks.",
        "render": [
            {
                "type": "options",
                "title": "Which do you want?",
                "content": null,
                "image": null,
                "options": [
                    {
                        "id": "beef",
                        "value": "Beef burger",
                        "image": null
                    },
                    {
                        "id": "chicken",
                        "value": "Chicken sandwich",
                        "image": null
                    },
                    {
                        "id": "plant",
                        "value": "Plant-based",
                        "image": null
                    }
                ]
            },
            {
                "type": "options",
                "title": "How healthy are we aiming?",
                "content": null,
                "image": null,
                "options": [
                    {
                        "id": "light",
                        "value": "Just a bit healthier",
                        "image": null
                    },
                    {
                        "id": "pretty",
                        "value": "Fairly healthy",
                        "image": null
                    },
                    {
                        "id": "as",
                        "value": "As healthy as possible (still fast)",
                        "image": null
                    }
                ]
            }
        ]
    }
];
const dummyMessages2 = [
    {
        "role": "user",
        "content": "[image: Screenshot_562 (1).png]"
    },
    {
        "content": "Vehicle identified from the registration: 2012 Mercedes-Benz CLS 550 coupe, White Pearl, 300 kW / 408 hp. Which part do you need?",
        "render": [],
        "vehicle": {
            "image": null,
            "make": "Mercedes-Benz",
            "model": "CLS 550",
            "yearFrom": 2012,
            "yearTo": null,
            "generation": null,
            "trim": null,
            "bodyType": "Coupe",
            "doors": null,
            "fuelType": null
        },
        "role": "assistant"
    }
]

export default function PartsSearchPage() {


    const [_inputValue, _setInputValue] = useState("");
    const [_isLoading, _setIsLoading] = useState(false);
    const [_messages, _setMessages] = useState([]);
    const [_vehicleInfo, _setVehicleInfo] = useState(null);
    const [_mediaFiles, _setMediaFiles] = useState([]);

    const handleInputChange = (v) => {
        _setInputValue(v);
    };


    const mediasToMessageObject = async (medias = []) => {
        return await Promise.all(
            medias.map(async (file) => ({
                type: 'image',
                image: await fileToBase64(file), // Accepts data URL ("data:image/jpeg;base64,...") or raw base64
            }))
        );
    };

    const handleSearch = async (e) => {
        e?.preventDefault?.();

        try {
            const txt = typeof e === 'string' ? e : _inputValue;
            if (!txt || txt.trim() === '') {
                logger.warn('Input value is empty. Please enter a search term.');
                return;
            };

            const newMessages = [..._messages, { role: 'user', content: txt }];
            const mediaObjects = await mediasToMessageObject(_mediaFiles);
            const userMessageForApi = {
                role: 'user',
                content: mediaObjects.length > 0
                    ? [{ type: 'text', text: txt }, ...mediaObjects]
                    : txt,
            };
            // logger.info('mediaObjects:', mediaObjects);
            // return;

            _setMessages(newMessages);
            _setIsLoading(true);

            const response = await sendBackRequest({
                itsFor: 'ai-search',
                action: 'searchParts',
                data: {
                    messages: [...newMessages, userMessageForApi],
                },
            });

            if (!response || !response.ok) {
                throw new Error(`Request failed: ${response?.status || 'unknown'}`);
            }

            if (!response.body) {
                throw new Error('No stream body returned by backend');
            }

            streamToData(response.body, (incoming) => {
                logger.info('Incoming stream data:', incoming);
                _setMessages((prev) => [...prev, ...incoming.filter(Boolean)]);
                _setIsLoading(false);

                if (incoming && incoming.length > 0) {
                    if (incoming[incoming.length - 1].vehicle) {
                        _setVehicleInfo(incoming[incoming.length - 1].vehicle);
                    }
                }
            }, null);

            _setInputValue('');
            _setMediaFiles([]);

        } catch (error) {
            logger.error('Error searching for parts:', error);
        } finally {
            // _setIsLoading(false);
        }
    };

    const handleOptionClick = (option) => {
        // logger.info('Option clicked:', option);
        // Handle the option click, e.g., update the input value or perform a search
        _setInputValue(option.value || '');
        handleSearch(option.value || '');
    };

    const handleCameraCapture = (file) => {
        if (!file) return;

        logger.info('Captured image file:', {
            name: file.name,
            type: file.type,
            size: file.size,
        });

        // Placeholder until image upload is wired to backend.
        _setInputValue((prev) => `${prev}${prev ? '\n' : ''}[image: ${file.name}]`);
        _setMediaFiles((prev) => [...prev, file]);
    };

    // useEffect(() => {
    //     // logger.info('Messages updated:', _messages.length);
    //     if (_isLoading) {
    //         // logger.info('Loading state is true, waiting for messages to update...');
    //         _setIsLoading(false);
    //     }
    // }, [_messages.length]);

    logger.info('Current messages:', _isLoading, _messages);

    return (
        <div className="w-full h-[calc(100vh-11.5rem)] flex flex-col items-center justify-center p-2 md:p-4">

            {
                _vehicleInfo && (
                    <div className="w-full mb-4">
                        <SearchVehicleCard vehicleInfo={_vehicleInfo} />
                    </div>
                )
            }

            <MessagesRenderer
                isLoading={_isLoading}
                messages={_messages}
                onOptionClick={handleOptionClick}
            />

            <div className="w-full flex">
                <AiInput
                    isLoading={_isLoading}
                    value={_inputValue}
                    onChange={handleInputChange}
                    onSubmit={handleSearch}
                    onCameraCapture={handleCameraCapture}
                    isCamera={true}
                />
            </div>
        </div>
    );
}



export const SearchVehicleCard = ({ vehicleInfo }) => {
    if (!vehicleInfo) return null;

    const {
        image,
        make,
        model,
        yearFrom,
        yearTo,
        generation,
        trim,
        bodyType,
        doors,
        fuelType,
    } = vehicleInfo;

    // Formatted year range
    const yearDisplay = yearFrom
        ? yearTo && yearTo !== yearFrom
            ? `${yearFrom}–${yearTo}`
            : yearFrom
        : null;

    // Filter out null/undefined details into tag pills so no vertical space is wasted
    const details = [
        yearDisplay && { label: 'Year', value: yearDisplay },
        generation && { label: 'Gen', value: generation },
        trim && { label: 'Trim', value: trim },
        bodyType && { label: 'Body', value: bodyType },
        fuelType && { label: 'Fuel', value: fuelType },
        doors && { label: 'Doors', value: `${doors}D` },
    ].filter(Boolean);

    return (
        <div className="flex h-32 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
            {/* LEFT SIDE: Image Container */}
            <div className="relative w-36 shrink-0 bg-slate-100">
                {image ? (
                    <img
                        src={image}
                        alt={`${make || 'Vehicle'} ${model || ''}`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-2 text-slate-400">
                        <CarIcon className="h-8 w-8" />
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            No Image
                        </span>
                    </div>
                )}
            </div>

            {/* RIGHT SIDE: Text & Details Container */}
            <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                {/* Title & Year Line */}
                <div>
                    <h3 className="truncate text-base font-bold tracking-tight text-slate-900">
                        {make || 'Unknown Make'} {model || 'Model'}
                    </h3>
                </div>

                {/* Compact Tag Pills (Flex Wrap) */}
                <div className="flex flex-wrap gap-1.5 overflow-hidden">
                    {details.length > 0 ? (
                        details.map((item, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                                <span className="text-slate-400 mr-1">{item.label}:</span>
                                <strong className="font-semibold text-slate-900">{item.value}</strong>
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-slate-400">No additional details</span>
                    )}
                </div>
            </div>
        </div>
    );
};

