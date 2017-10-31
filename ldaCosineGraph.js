var path = require('path');
var fs = require('fs');
var lda = require('lda');
var nlp = require('wink-nlp-utils');
var cosine = require('wink-distance').bow.cosine;

const report_folder = 'reports/mescaline';
const nb_topics = 10;
const nb_terms = 5;
const output_file = 'graph.json';

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

    var ldaResults = lda(files.map(item => item.contents), nb_topics, nb_terms);
    var graph = {
      nodes: ldaResults.theta.map((theta, index) => {
        return {id: index, metadata: {theta: theta}};
      }),
      edges: []
    }

    let cosineNodes = graph.nodes;

    graph.nodes.forEach(nodeA => {

      // Remove node on each pass
      cosineNodes = cosineNodes.filter(nodeB => nodeA.id != nodeB.id);

      cosineNodes.forEach(nodeB => {

        graph.edges.push({
          source: nodeA.id,
          target: nodeB.id,
          weight: cosine(
            nodeA.metadata.theta.reduce(function(result, theta, index) {
              result['topic' + index] = theta;
              return result;
            }, {}),
            nodeB.metadata.theta.reduce(function(result, theta, index) {
              result['topic' + index] = theta;
              return result;
            }, {})
          )
        });

      });

    });

    fs.writeFile(ouput_file, JSON.stringify(graph));
})
.catch( error => {
    console.log( error );
});
