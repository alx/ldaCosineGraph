var path = require('path');
var fs = require('fs');
var lda = require('lda');
var nlp = require('wink-nlp-utils');
var cosine = require('wink-distance').bow.cosine;

const report_folder = 'reports/mescaline';
const nb_topics = 10;
const nb_terms = 5;
// set to -1 to output all edges
const min_weight = 0.7;
const output_file = 'output/graph.json';

/**
 * Promise all
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 */
function promiseAllP(items, block) {
    var promises = [];
    items.forEach(function(item,index) {
        promises.push( function(item,i) {
            return new Promise(function(resolve, reject) {
                return block.apply(this,[item,index,resolve,reject]);
            });
        }(item,index))
    });
    return Promise.all(promises);
} //promiseAll

/**
 * read files
 * @param dirname string
 * @return Promise
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 * @see http://stackoverflow.com/questions/10049557/reading-all-files-in-a-directory-store-them-in-objects-and-send-the-object
 */
function readFiles(dirname) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, function(err, filenames) {
            if (err) return reject(err);
            promiseAllP(filenames,
            (filename,index,resolve,reject) =>  {
                fs.readFile(path.resolve(dirname, filename), 'utf-8', function(err, content) {
                    if (err) return reject(err);
                    const tokens = nlp.string.tokenize(content);
                    const stems = nlp.tokens.stem(tokens);
                    return resolve({filename: filename, contents: stems.join(' ')});
                });
            })
            .then(results => {
                return resolve(results);
            })
            .catch(error => {
                return reject(error);
            });
        });
  });
}

readFiles( report_folder )
.then(files => {
    console.log( "loaded ", files.length );

    const fileContent = files.filter(item => item.contents.length > 0).map(item => item.contents);
    var ldaResults = lda(fileContent, nb_topics, nb_terms);
    var graph = {
      nodes: ldaResults.theta.map((theta, index) => {
        return {
          id: 'n' + index,
          label: 'n' + index,
          x: Math.random(),
          y: Math.random(),
          size: 1,
          metadata: {theta: theta},
        };
      }),
      edges: []
    }

    let cosineNodes = graph.nodes;
    let edge_id = 0;

    graph.nodes.forEach(nodeA => {

      // Remove node on each pass
      cosineNodes = cosineNodes.filter(nodeB => nodeA.id != nodeB.id);

      cosineNodes.forEach(nodeB => {

        const weight = cosine(
          nodeA.metadata.theta.reduce(function(result, theta, index) {
            result['topic' + index] = theta;
            return result;
          }, {}),
          nodeB.metadata.theta.reduce(function(result, theta, index) {
            result['topic' + index] = theta;
            return result;
          }, {})
        );


        if(weight > min_weight) {
          edge_id += 1;
          graph.edges.push({
            id: 'e' + edge_id,
            source: nodeA.id,
            target: nodeB.id,
          });
        }

      });

    });

    fs.writeFile(output_file, JSON.stringify(graph, null, 2));
})
.catch( error => {
    console.log( error );
});
