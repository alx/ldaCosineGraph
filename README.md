
ldaCosineGraph
=======

Use LDA and Cosine Similarity on a folder containing text files to generate a Parasol-compatible graph.

## Install

```
git clone https://github.com/alx/ldaCosineGraph.git
cd ldaCosineGraph
yarn install
```

## Configure

Edit `ldaCosineGraph.js` header to modify default configuration.

```
const report_folder = 'reports/mescaline';
const nb_topics = 10;
const nb_terms = 5;
const min_weight = 0.7;
const output_file = 'graph.json';
```

## Run

```
node ldaCosineGraph.js reports_folder_name
```

Graph file will be available in the `output_file` target (`reports_folder_name.json` by default).

To run all reports subfolder at once:

```
for f in reports/*; do dir=${f%*/}; node ldaCosineGraph.js ${dir##*/} ; done
```

