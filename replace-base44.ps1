$excludeDirs = @('node_modules', '.git', 'dist', 'package-lock.json')
$extensions = @('*.js', '*.jsx', '*.ts', '*.tsx', '*.json', '*.md', '*.html', '*.env')

$files = Get-ChildItem -Path "D:\AI\Fixit" -Recurse -Include $extensions | Where-Object {
    $path = $_.FullName
    -not ($excludeDirs | Where-Object { $path -match [regex]::Escape($_) })
}

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -match 'base44') {
        # Replace all case variations
        $newContent = $content `
            -replace 'base44Client', 'fixitClient' `
            -replace 'base44_token', 'fixit_token' `
            -replace 'base44_access_token', 'fixit_access_token' `
            -replace '@base44/sdk', '@fixit/sdk' `
            -replace '@base44/vite-plugin', '@fixit/vite-plugin' `
            -replace 'base44-app', 'fixit-app' `
            -replace 'Base44 APP', 'Fixit APP' `
            -replace 'base44\.entities', 'fixit.entities' `
            -replace 'base44\.auth', 'fixit.auth' `
            -replace 'base44\.functions', 'fixit.functions' `
            -replace 'base44\.storage', 'fixit.storage' `
            -replace "from '@/api/base44Client'", "from '@/api/fixitClient'" `
            -replace "from ""@/api/base44Client""", "from ""@/api/fixitClient""" `
            -replace "import { base44 }", "import { fixit }" `
            -replace 'const base44 = ', 'const fixit = ' `
            -replace 'export const base44 ', 'export const fixit ' `
            -replace '{ base44,', '{ fixit,' `
            -replace ', base44 }', ', fixit }' `
            -replace '{ base44 }', '{ fixit }' `
            -replace '\bbase44\b', 'fixit'

        if ($newContent -ne $content) {
            Set-Content $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
            Write-Host "Updated: $($file.FullName)"
            $count++
        }
    }
}
Write-Host "`nTotal files updated: $count"
