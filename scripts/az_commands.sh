az staticwebapp create \
   --name carnivalcash-dev \
   --resource-group eu-hack-rg \
   --location eastus2 \
   --sku Free


    az staticwebapp secrets list --name carnivalcash-dev --resource-group eu-hack-rg --query "properties.apiKey" -o tsv

 az webapp show --name carnivalcash-api --resource-group eu-hack-rg --query appServicePlanId -o tsv

az webapp create \
   --name carnivalcash-api-dev \
   --resource-group eu-hack-rg \
   --plan "/subscriptions/e4dfe493-dab7-44d5-811f-84cd7ae7fb34/resourceGroups/eu-hack-rg/providers/Microsoft.Web/serverfarms/ASP-euhackrg-b7a4" \
   --runtime "PYTHON:3.11"



 az ad app list --filter "displayName eq 'carnivalcash-api-dev'" --query "[].id" -o tsv




 az ad app federated-credential create \
   --id c7e47844-52f7-44d7-bd45-385063420cb5 \
   --parameters '{
     "name": "carnivalcash-dev-branch",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:kishorependyala/carnivalcash:ref:refs/heads/dev",
     "audiences": ["api://AzureADTokenExchange"]
   }'