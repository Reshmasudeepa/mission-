const http = require("http");
const fs = require("fs");

const PORT = 4000;

// Helper: Send JSON response
function sendJSON(res, statusCode, body) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

// Load products from JSON file
function loadProducts() {
    const raw = fs.readFileSync("./mock_products.json", "utf8");
    return JSON.parse(raw);
}

// Normalize product (handle messy data)
function normalize(product) {
    return {
        id: product.id,
        name: product.name || "Unnamed",
        category: product.category || null,
        price: product.price === null || product.price === undefined ?
            null :
            Number(product.price),
        stock: product.stock === null || product.stock === undefined ?
            null :
            Number(product.stock),
    };
}

// Validate request body
function validate(body) {
    const errors = [];
    const filters = {};

    if (body.category !== undefined) {
        if (typeof body.category !== "string") {
            errors.push({ field: "category", message: "Must be a string" });
        } else {
            filters.category = body.category;
        }
    }

    if (body.minPrice !== undefined) {
        if (typeof body.minPrice !== "number") {
            errors.push({ field: "minPrice", message: "Must be a number" });
        } else {
            filters.minPrice = body.minPrice;
        }
    }

    if (body.maxPrice !== undefined) {
        if (typeof body.maxPrice !== "number") {
            errors.push({ field: "maxPrice", message: "Must be a number" });
        } else {
            filters.maxPrice = body.maxPrice;
        }
    }

    if (
        filters.minPrice !== undefined &&
        filters.maxPrice !== undefined &&
        filters.minPrice > filters.maxPrice
    ) {
        errors.push({
            field: "minPrice",
            message: "minPrice cannot be greater than maxPrice",
        });
    }

    if (body.inStockOnly !== undefined) {
        if (typeof body.inStockOnly !== "boolean") {
            errors.push({
                field: "inStockOnly",
                message: "Must be true or false",
            });
        } else {
            filters.inStockOnly = body.inStockOnly;
        }
    }

    return { filters, errors };
}

// Apply search filters
function search(products, filters) {
    return products.filter((p) => {
        if (filters.category && p.category !== filters.category) return false;
        if (filters.minPrice !== undefined && p.price !== null && p.price < filters.minPrice)
            return false;
        if (filters.maxPrice !== undefined && p.price !== null && p.price > filters.maxPrice)
            return false;
        if (filters.inStockOnly && (!p.stock || p.stock <= 0)) return false;
        return true;
    });
}

// Create server
const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/products/search") {
        let body = "";

        req.on("data", (chunk) => (body += chunk.toString()));

        req.on("end", () => {
            let parsed;

            try {
                parsed = body ? JSON.parse(body) : {};
            } catch {
                return sendJSON(res, 400, {
                    error: { code: "BAD_REQUEST", details: ["Invalid JSON"] },
                });
            }

            const { filters, errors } = validate(parsed);

            if (errors.length > 0) {
                return sendJSON(res, 400, {
                    error: { code: "BAD_REQUEST", details: errors },
                });
            }

            const rawProducts = loadProducts().map(normalize);
            const result = search(rawProducts, filters);

            return sendJSON(res, 200, {
                total: result.length,
                items: result,
            });
        });
    } else {
        sendJSON(res, 404, {
            error: { code: "NOT_FOUND", message: "Route not found" },
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log("Server running at http://localhost:" + PORT);
});