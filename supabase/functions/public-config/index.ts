import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch wallet config using service role (table is now locked down)
    const { data: walletConfig } = await supabase
      .from("wallet_config")
      .select("vault_wallet_address, payout_wallet_address, token_contract_address, min_token_balance, payout_percentage, twitter_user_id, twitter_username")
      .maybeSingle();

    // Return only safe, public-facing fields
    return new Response(
      JSON.stringify({
        vault_wallet_address: walletConfig?.vault_wallet_address || "",
        payout_wallet_address: walletConfig?.payout_wallet_address || "",
        token_contract_address: walletConfig?.token_contract_address || "",
        min_token_balance: walletConfig?.min_token_balance || 1,
        payout_percentage: walletConfig?.payout_percentage || 15,
        twitter_user_id: walletConfig?.twitter_user_id || "44196397",
        twitter_username: walletConfig?.twitter_username || "elonmusk",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
