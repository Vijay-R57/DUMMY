
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const pixelBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    console.log("Invoking edge function...");
    const { data, error } = await supabase.functions.invoke("analyze-5s", {
        body: { beforeImage: pixelBase64, afterImage: pixelBase64 },
    });

    if (error) {
        console.log("Supabase Error:", error);

        // Check if error is FunctionsHttpError
        if (error.constructor.name === 'FunctionsHttpError') {
            try {
                // We can't access the body directly from error sometimes, let's do a raw fetch
                console.log("Doing raw fetch to see full response...");
                const response = await fetch(`${supabaseUrl}/functions/v1/analyze-5s`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ beforeImage: pixelBase64, afterImage: pixelBase64 })
                });
                const errText = await response.text();
                console.log("Raw Response Status:", response.status);
                console.log("Raw Response Body:", errText);
            } catch (e) {
                console.log("Raw fetch error:", e);
            }
        }
    } else {
        console.log("Success:", data);
    }
}

test();
