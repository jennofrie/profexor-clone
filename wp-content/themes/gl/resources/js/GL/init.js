import fs from 'fs'
import codeData from './addon.js'

for (const key of Object.keys(codeData)) {
  const codesData = codeData[key]
  const filePath = key

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err}`)
      
      return
    }

    for (const comment of Object.keys(codesData)) {
      const value = codeData[filePath][comment];

      data = data.replace(`// ${comment}`, value)
    }

    fs.writeFile(filePath, data, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing file: ${err}`)

        return
      }
    })
  })
}
