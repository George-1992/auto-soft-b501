import { logger } from "./logger";

// // example custom meta items array
// [
//     {
//         type: 'meta',
//         name: 'viewport',
//         content: 'width=device-width, initial-scale=1.0',
//     }
// ]

const storedMetas = {};

export const setMetas = ({
    title, description, icon, custom = [], ...otherMetas
} = {}) => {

    // const { pathname: currentPath } = useLocation();
    // logger.info('setMetas called with:', { title, description, icon, custom, otherMetas, currentPath });

    try {
        if (!document.head) {
            logger.warn('No head element found in the document.');
            return;
        }

        // 1. Handle Document Title
        if (title) {
            document.title = title;
        }

        // 2. Handle Description Meta Tag
        if (description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', description);
        }

        // 3. Helper to create or update generic meta tags
        const applyMeta = (attributes) => {
            const key = attributes.name ? 'name' : attributes.property ? 'property' : null;
            let meta = key ? document.querySelector(`meta[${key}="${attributes[key]}"]`) : null;

            if (!meta) {
                meta = document.createElement('meta');
                document.head.appendChild(meta);
            }

            Object.entries(attributes).forEach(([attr, val]) => {
                if (val !== undefined && val !== null) {
                    meta.setAttribute(attr, val);
                }
            });
        };

        // 4. Handle Direct Named Properties passed in options (e.g. ogTitle, keywords, canonical)
        Object.entries(otherMetas).forEach(([key, value]) => {
            if (!value) return;

            // Map common shorthand names to standard meta attributes
            if (key.startsWith('og')) {
                const prop = `og:${key.slice(2).toLowerCase()}`;
                applyMeta({ property: prop, content: value });
            } else if (key.startsWith('twitter')) {
                const name = `twitter:${key.slice(7).toLowerCase()}`;
                applyMeta({ name: name, content: value });
            } else {
                applyMeta({ name: key, content: value });
            }
        });

        // 5. Handle Custom Items Array (for specialized or non-standard meta tags)
        if (Array.isArray(custom)) {
            custom.forEach((item) => {
                if (item && typeof item === 'object') {
                    const { type, ...attrs } = item;
                    applyMeta(attrs);
                }
            });
        }

        // 6. Handle Icon Link Tag
        if (icon) {
            let linkIcon = document.querySelector('link[rel="icon"]');
            if (!linkIcon) {
                linkIcon = document.createElement('link');
                linkIcon.setAttribute('rel', 'icon');
                document.head.appendChild(linkIcon);
            }
            linkIcon.setAttribute('href', icon);
        }

    } catch (error) {
        logger.error('Error setting metas:', error);
    }
};
