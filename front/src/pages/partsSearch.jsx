import { AiInput, MessagesRenderer, streamToData } from "@/src/components/ai/streamV2";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import _ from "lodash";
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

export default function PartsSearchPage() {


    const [_inputValue, _setInputValue] = useState("");
    const [_isLoading, _setIsLoading] = useState(false);
    const [_messages, _setMessages] = useState([]);

    const handleInputChange = (v) => {
        _setInputValue(v);
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
            _setMessages(newMessages);
            _setIsLoading(true);
            const response = await sendBackRequest({
                itsFor: 'ai-search',
                action: 'searchParts',
                data: {
                    messages: newMessages,
                },
            });

            if (!response || !response.ok) {
                throw new Error(`Request failed: ${response?.status || 'unknown'}`);
            }

            if (!response.body) {
                throw new Error('No stream body returned by backend');
            }

            streamToData(response.body, (incoming) => {
                _setMessages((prev) => [...prev, ...incoming.filter(Boolean)]);
            }, null);

            _setInputValue('');

        } catch (error) {
            logger.error('Error searching for parts:', error);
        } finally {
            _setIsLoading(false);
        }
    };

    const handleOptionClick = (option) => {
        // logger.info('Option clicked:', option);
        // Handle the option click, e.g., update the input value or perform a search
        _setInputValue(option.value || '');
        handleSearch(option.value || '');
    };


    logger.info('Current messages:', _isLoading, _messages);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
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
                />
            </div>
        </div>
    );
}


